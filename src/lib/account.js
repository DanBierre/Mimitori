// account.js
// Talks to the account server (server/handler.js): email sign-in codes, and one saved copy of
// the learner's words per account. The copy is the synced parts of the state, gzipped, in base64.
import { mergeState, synced } from "./syncMerge.js";

const API = import.meta.env?.VITE_API || "https://api.mimitori.com";
const KEY = "mimitori-account";

export function loadAccount() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY));
    return a?.session ? a : null;
  } catch {
    return null;
  }
}
export function saveAccount(a) {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: signed in for this visit only */
  }
}

// An Error whose message is fit to show the learner; status 401 means the session ended.
const fail = (status, message) => Object.assign(new Error(message), { status });

async function call(path, { method = "GET", token, body, headers = {} } = {}) {
  let r;
  try {
    r = await fetch(API + path, {
      method,
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(body && typeof body !== "string" && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: typeof body === "string" ? body : body && JSON.stringify(body),
    });
  } catch {
    throw fail(0, "Couldn't reach the server. Check your connection.");
  }
  if (r.ok || r.status === 409) return r;
  if (r.status === 401) throw fail(401, "You were signed out. Sign in again to keep syncing.");
  if (r.status === 429) throw fail(429, "Too many tries. Wait a bit, then try again.");
  if (r.status === 413) throw fail(413, "Your word list is too big to sync.");
  throw fail(r.status, "Something went wrong on the server. Try again soon.");
}

export async function startSignIn(email) {
  try {
    await call("/auth/start", { method: "POST", body: { email } });
  } catch (e) {
    throw e.status === 400 ? fail(400, "That email doesn't look right.") : e;
  }
}

// Returns { session, email }
export async function finishSignIn(email, code) {
  try {
    return await (await call("/auth/verify", { method: "POST", body: { email, code } })).json();
  } catch (e) {
    throw e.status === 400 ? fail(400, "That code didn't work. Check it, or send a new one.") : e;
  }
}

export const signOut = (token) => call("/signout", { method: "POST", token }).catch(() => {});
export const deleteAccount = (token) => call("/account", { method: "DELETE", token });

// Gzip + base64: a few thousand words fit easily under the server's 1.9 MB cap.
export async function pack(obj) {
  const zipped = new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(zipped).arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export async function unpack(text) {
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const plain = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(plain).text());
}

// What travels: the synced parts, minus the Anki setup (it belongs to this computer's Anki).
export function forUpload(state) {
  const s = synced(state);
  const { anki, ...settings } = s.settings;
  return { ...s, settings };
}

// The same JSON whatever order the keys were added in, to tell whether anything changed.
export const fingerprint = (state) =>
  JSON.stringify(forUpload(state), (k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v
  );

// One round: read the server's copy, hand it to `apply` (which joins it into this device),
// then save the joined copy back unless it already matches. A 409 means another device saved
// in between, so read again. Returns the fingerprint of what the server now holds.
export async function syncOnce(token, getLocal, apply) {
  for (let i = 0; i < 3; i++) {
    const got = await call("/copy", { token });
    const version = Number(got.headers.get("X-Version")) || 0;
    const text = await got.text();
    const remote = text ? await unpack(text) : null;
    if (remote) apply(remote);
    // Joined the same way round as the store's "synced" step, so both land on the same copy
    const joined = forUpload(mergeState(getLocal(), remote));
    const print = fingerprint(joined);
    if (remote && print === fingerprint(mergeState(remote, null))) return print;
    const put = await call("/copy", { method: "PUT", token, body: await pack(joined), headers: { "If-Match": String(version) } });
    if (put.status !== 409) return print;
  }
  throw fail(409, "Another device kept saving at the same time. Try again in a moment.");
}
