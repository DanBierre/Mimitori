const API_VERSION = 6;

// The Mimitori add-on first, then AnkiConnect as a fallback. Both speak the same JSON.
export const ADDON_URL = "http://127.0.0.1:8766";
export const ANKICONNECT_URL = "http://127.0.0.1:8765";

export class AnkiError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = "AnkiError";
    this.kind = kind; // "unreachable" | "anki"
  }
}

export function createAnki({
  fetchImpl = globalThis.fetch,
  urls = [ADDON_URL, ANKICONNECT_URL],
} = {}) {
  let url = urls[0]; // whichever answered last

  async function call(to, action, params = {}) {
    let body;
    try {
      const res = await fetchImpl(to, {
        method: "POST",
        body: JSON.stringify({ action, version: API_VERSION, params }),
      });
      if (res.ok === false) {
        throw new AnkiError(`Anki replied ${res.status} ${res.statusText || ""}`.trim(), "anki");
      }
      body = await res.json();
    } catch (e) {
      if (e instanceof AnkiError) throw e;
      throw new AnkiError(e?.message || "Anki is unreachable", "unreachable");
    }
    if (body?.error) throw new AnkiError(body.error, "anki");
    return body?.result;
  }

  const invoke = (action, params) => call(url, action, params);

  // Tries each URL in order and sticks with the first that answers.
  async function first(action) {
    for (const to of urls) {
      try {
        const result = await call(to, action);
        url = to;
        return { result };
      } catch (e) {
        if (e.kind !== "unreachable") throw e;
      }
    }
    return null;
  }

  // Maps a version call to a status. Throws only non-"unreachable" errors.
  async function checkConnection() {
    const hit = await first("version");
    if (!hit) return "unreachable";
    return hit.result >= API_VERSION ? "ok" : "outdated";
  }

  // AnkiConnect blocks origins it hasn't allowed (they look unreachable) but always answers requestPermission.
  async function connect() {
    const hit = await first("requestPermission");
    if (!hit) return "unreachable";
    if (hit.result?.permission !== "granted") return "forbidden";
    return checkConnection();
  }

  return { invoke, checkConnection, connect };
}
