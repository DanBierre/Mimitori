// Mimitori account server: email and password sign-in, sessions, and one saved copy per account.
// An emailed code proves the address once, when the account is made or the password is reset.
// Pure (no Cloudflare imports) so tests run it in Node. deps = { db, mail, now, random }.
// The sign-in and its limits follow Shoji's account server, which has been in use for a while.

const CODE_LIFE = 10 * 60_000, HOUR = 60 * 60_000, DAY = 24 * HOUR;
const MAX_LOGINS_PER_HOUR = 10, PW_ROUNDS = 100_000; // the most PBKDF2 rounds Workers allow
const MAX_TRIES = 5, MAX_CODES_PER_HOUR = 5, MAX_TRIES_PER_DAY = 30, MAX_STARTS_PER_IP = 20, MAX_VERIFIES_PER_IP = 60;
// Every code mailed, from everyone, per hour: a ceiling on what abuse can cost. People who already have
// an account count separately, so a flood of made-up addresses can't stop them signing in.
const MAX_MAILS_PER_HOUR = 1000, MAX_KNOWN_MAILS_PER_HOUR = 5000;
const SESSION_IDLE = 180 * DAY, SESSION_MAX = 365 * DAY;
// D1 keeps at most 2 MB in one value. Gzipped, that's tens of thousands of words.
export const MAX_COPY = 1_900_000;
// No spaces, commas or angle brackets: one address, nothing that could reach a mail header
const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, If-Match",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "X-Version",
};
export const reply = (status, data, headers = {}) =>
  new Response(data === undefined ? null : JSON.stringify(data), {
    status,
    headers: { ...CORS, ...(data === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
  });

export async function sha256Hex(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const hex = (deps, n) => [...deps.random(n)].map((b) => b.toString(16).padStart(2, "0")).join("");
const cleanEmail = (e) => (typeof e === "string" && e.length <= 300 ? e.trim().toLowerCase() : "");
const str = (v) => typeof v === "string" && v.trim() !== "";
const goodPassword = (p) => typeof p === "string" && p.length >= 8 && p.length <= 200;

// Salted PBKDF2, stored as pbkdf2$rounds$salt$hash, so the rounds can rise later without breaking old ones
async function pbkdf2(password, salt, rounds) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: Uint8Array.from(salt.match(/../g), (h) => parseInt(h, 16)), iterations: rounds }, key, 256);
  return toHex(new Uint8Array(bits));
}
async function hashPassword(deps, password) {
  const salt = hex(deps, 16);
  return ["pbkdf2", PW_ROUNDS, salt, await pbkdf2(password, salt, PW_ROUNDS)].join("$");
}
// No account still costs a full hash, so the reply time doesn't say whether the address has one
async function passwordMatches(password, stored) {
  const [, rounds, salt, hash] = (stored || ["pbkdf2", PW_ROUNDS, "0".repeat(32), "-"].join("$")).split("$");
  return (await pbkdf2(password, salt, Number(rounds))) === hash;
}
// name+1@ and dotted Gmail addresses reach one mailbox, so they share its limit
export function mailbox(email) {
  let [user, domain] = email.split("@");
  user = user.split("+")[0];
  if (domain === "gmail.com" || domain === "googlemail.com") [user, domain] = [user.replace(/\./g, ""), "gmail.com"];
  return `${user}@${domain}`;
}
// IPv6 counts per /64: one connection is handed billions of addresses inside it
const fromIp = (req) => {
  const ip = req.headers.get("CF-Connecting-IP") || "";
  return ip.includes(":") ? ip.split("::")[0].split(":").concat("0", "0", "0", "0").slice(0, 4).join(":") + "::/64" : ip;
};

// Count one try under `key`; false once `max` tries have happened inside the window.
// Each step is one statement that checks and changes together, so parallel calls can't slip past the cap.
async function limit(deps, key, max, windowMs) {
  const now = deps.now(), db = deps.db;
  const bump = async () =>
    (await db.prepare("UPDATE attempts SET count = count + 1 WHERE key = ? AND reset_at > ? AND count < ?").bind(key, now, max).run())
      .meta.changes === 1;
  if (await bump()) return true;
  const started = await db
    .prepare("INSERT INTO attempts (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at WHERE attempts.reset_at <= ?")
    .bind(key, now + windowMs, now)
    .run();
  return started.meta.changes === 1 || (await bump());
}

async function session(req, deps) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  const hash = token && (await sha256Hex(token));
  const now = deps.now();
  const row = hash && (await deps.db
    .prepare("SELECT account_id FROM sessions WHERE token_hash = ? AND last_seen > ? AND created > ?")
    .bind(hash, now - SESSION_IDLE, now - SESSION_MAX)
    .first());
  if (!row) return reply(401, { error: "sign in again" });
  // Stamped at most once a day: a sync every few minutes needn't be a database write each time
  await deps.db.prepare("UPDATE sessions SET last_seen = ? WHERE token_hash = ? AND last_seen < ?").bind(now, hash, now - DAY).run();
  return { accountId: row.account_id, hash };
}

async function newSession(deps, accountId, email) {
  const token = hex(deps, 32), now = deps.now();
  await deps.db.prepare("INSERT INTO sessions (token_hash, account_id, created, last_seen) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), accountId, now, now).run();
  return reply(200, { session: token, email });
}

// Over a limit still answers 200, so the reply never says anything about the address
async function start(req, deps) {
  const email = cleanEmail((await req.json().catch(() => ({}))).email);
  if (!EMAIL.test(email) || email.length > 254) return reply(400, { error: "bad email" });
  const ip = fromIp(req);
  const known = await deps.db.prepare("SELECT 1 AS x FROM accounts WHERE email = ?").bind(email).first();
  const allowed = (!ip || (await limit(deps, "ip-start:" + ip, MAX_STARTS_PER_IP, HOUR)))
    && (await limit(deps, "email-start:" + mailbox(email), MAX_CODES_PER_HOUR, HOUR))
    && (await (known ? limit(deps, "known-mail", MAX_KNOWN_MAILS_PER_HOUR, HOUR) : limit(deps, "all-mail", MAX_MAILS_PER_HOUR, HOUR)));
  if (!allowed) return reply(200, {});
  const n = new DataView(deps.random(4).buffer.slice(0, 4)).getUint32(0);
  const code = String(n % 1_000_000).padStart(6, "0");
  await deps.db.prepare("INSERT OR REPLACE INTO email_codes (email, code_hash, tries, expires) VALUES (?, ?, 0, ?)")
    .bind(email, await sha256Hex(code), deps.now() + CODE_LIFE).run();
  await deps.mail(email, "Your Mimitori sign-in code",
    `Your Mimitori code is ${code}. It works for 10 minutes. If you didn't ask for it, you can ignore this email.`, code);
  return reply(200, {});
}

// Spends one try on the address's code; true only for the right code. Tries count only while a code is live,
// so guessing at an address with no code can't lock its owner out.
async function useCode(deps, email, code) {
  const now = deps.now();
  const counted = await deps.db.prepare("UPDATE email_codes SET tries = tries + 1 WHERE email = ? AND tries < ? AND expires >= ?")
    .bind(email, MAX_TRIES, now).run();
  if (counted.meta.changes !== 1) {
    await deps.db.prepare("DELETE FROM email_codes WHERE email = ? AND (tries >= ? OR expires < ?)").bind(email, MAX_TRIES, now).run();
    return false;
  }
  if (!(await limit(deps, "email-tries:" + email, MAX_TRIES_PER_DAY, DAY))) return false;
  // Deleting the row that matches is what uses the code up, so only one parallel request can win
  const used = await deps.db.prepare("DELETE FROM email_codes WHERE email = ? AND code_hash = ?").bind(email, await sha256Hex(code.trim())).run();
  if (used.meta.changes === 1) return true;
  // The 5th wrong try cancels the code, so even the right one fails afterwards
  await deps.db.prepare("DELETE FROM email_codes WHERE email = ? AND tries >= ?").bind(email, MAX_TRIES).run();
  return false;
}

// The right code makes the account, or resets its password, and signs in
async function verify(req, deps) {
  const b = await req.json().catch(() => ({}));
  const email = cleanEmail(b.email);
  if (!email || !str(b.code)) return reply(400, { error: "bad request" });
  if (!goodPassword(b.password)) return reply(400, { error: "bad password" });
  const ip = fromIp(req);
  if (ip && !(await limit(deps, "ip-verify:" + ip, MAX_VERIFIES_PER_IP, HOUR))) return reply(429, { error: "too many tries" });
  if (!(await useCode(deps, email, b.code))) return reply(400, { error: "bad code" });
  const pw = await hashPassword(deps, b.password);
  let account = await deps.db.prepare("SELECT id FROM accounts WHERE email = ?").bind(email).first();
  if (account) {
    await deps.db.prepare("UPDATE accounts SET pw_hash = ? WHERE id = ?").bind(pw, account.id).run();
  } else {
    account = { id: hex(deps, 16) };
    await deps.db.prepare("INSERT INTO accounts (id, email, created, pw_hash) VALUES (?, ?, ?, ?)").bind(account.id, email, deps.now(), pw).run();
  }
  return newSession(deps, account.id, email);
}

// Email and password. One answer for a wrong password and an unknown address, so it never says which
async function login(req, deps) {
  const b = await req.json().catch(() => ({}));
  const email = cleanEmail(b.email);
  if (!email || typeof b.password !== "string" || b.password.length > 200) return reply(400, { error: "bad request" });
  const ip = fromIp(req);
  if ((ip && !(await limit(deps, "ip-verify:" + ip, MAX_VERIFIES_PER_IP, HOUR)))
    || !(await limit(deps, "login:" + email, MAX_LOGINS_PER_HOUR, HOUR))) return reply(429, { error: "too many tries" });
  const account = await deps.db.prepare("SELECT id, pw_hash FROM accounts WHERE email = ?").bind(email).first();
  if (!(await passwordMatches(b.password, account?.pw_hash)) || !account?.pw_hash) return reply(400, { error: "bad login" });
  return newSession(deps, account.id, email);
}

async function signout(req, deps) {
  const s = await session(req, deps);
  if (s instanceof Response) return s;
  await deps.db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(s.hash).run();
  return reply(200, {});
}

async function me(req, deps) {
  const s = await session(req, deps);
  if (s instanceof Response) return s;
  const a = await deps.db.prepare("SELECT email FROM accounts WHERE id = ?").bind(s.accountId).first();
  return reply(200, { email: a?.email });
}

// The saved copy as the app sent it, with its version in X-Version. No copy yet: version 0, empty body.
async function getCopy(req, deps) {
  const s = await session(req, deps);
  if (s instanceof Response) return s;
  const row = await deps.db.prepare("SELECT data, version FROM copies WHERE account_id = ?").bind(s.accountId).first();
  return new Response(row?.data ?? "", { status: 200, headers: { ...CORS, "Content-Type": "text/plain", "X-Version": String(row?.version ?? 0) } });
}

// Saves only on top of the version the app last read (If-Match), so a device that missed a change
// gets 409 and merges first instead of overwriting it.
async function putCopy(req, deps) {
  const s = await session(req, deps);
  if (s instanceof Response) return s;
  const base = Number(req.headers.get("If-Match"));
  if (!Number.isInteger(base) || base < 0) return reply(400, { error: "bad version" });
  const data = await req.text();
  if (!data || data.length > MAX_COPY) return reply(413, { error: "too big" });
  const now = deps.now();
  const done = base === 0
    ? await deps.db.prepare("INSERT INTO copies (account_id, data, version, updated) VALUES (?, ?, 1, ?) ON CONFLICT(account_id) DO NOTHING")
      .bind(s.accountId, data, now).run()
    : await deps.db.prepare("UPDATE copies SET data = ?, version = version + 1, updated = ? WHERE account_id = ? AND version = ?")
      .bind(data, now, s.accountId, base).run();
  if (done.meta.changes !== 1) return reply(409, { error: "changed elsewhere" });
  return reply(200, { version: base + 1 });
}

// The account and everything kept for it. Words on the devices stay there.
async function deleteAccount(req, deps) {
  const s = await session(req, deps);
  if (s instanceof Response) return s;
  const a = await deps.db.prepare("SELECT email FROM accounts WHERE id = ?").bind(s.accountId).first();
  const gone = (sql, value = s.accountId) => deps.db.prepare(sql).bind(value);
  await deps.db.batch([
    gone("DELETE FROM sessions WHERE account_id = ?"),
    gone("DELETE FROM copies WHERE account_id = ?"),
    gone("DELETE FROM email_codes WHERE email = ?", a?.email ?? ""),
    gone("DELETE FROM accounts WHERE id = ?"),
  ]);
  return reply(200, {});
}

const routes = {
  "POST /auth/start": start,
  "POST /auth/verify": verify,
  "POST /auth/login": login,
  "POST /signout": signout,
  "GET /me": me,
  "GET /copy": getCopy,
  "PUT /copy": putCopy,
  "DELETE /account": deleteAccount,
};

// A thrown error must still carry CORS headers, or the app sees an opaque fetch failure
export async function handle(req, deps) {
  if (req.method === "OPTIONS") return reply(204);
  const fn = routes[`${req.method} ${new URL(req.url).pathname}`];
  if (!fn) return reply(404, { error: "not found" });
  try {
    return await fn(req, deps);
  } catch (e) {
    console.error(e);
    return reply(500, { error: "server error" });
  }
}
