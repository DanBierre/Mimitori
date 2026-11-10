const API_VERSION = 6;

export class AnkiError extends Error {
  constructor(message, kind) {
    super(message);
    this.name = "AnkiError";
    this.kind = kind; // "unreachable" | "anki"
  }
}

export function createAnki({
  fetchImpl = globalThis.fetch,
  url = "http://127.0.0.1:8765",
} = {}) {
  async function invoke(action, params = {}) {
    let body;
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        body: JSON.stringify({ action, version: API_VERSION, params }),
      });
      body = await res.json();
    } catch (e) {
      throw new AnkiError(e?.message || "Anki is unreachable", "unreachable");
    }
    if (body.error) throw new AnkiError(body.error, "anki");
    return body.result;
  }

  // Maps a version call to a status. Throws only non-"unreachable" errors.
  async function versionStatus() {
    try {
      return (await invoke("version")) >= API_VERSION ? "ok" : "outdated";
    } catch (e) {
      if (e.kind === "unreachable") return "unreachable";
      throw e;
    }
  }

  // An origin AnkiConnect hasn't allowed yet is CORS-blocked, so it looks unreachable.
  const checkConnection = versionStatus;

  async function connect() {
    try {
      const res = await invoke("requestPermission");
      if (res?.permission !== "granted") return "forbidden";
    } catch (e) {
      if (e.kind === "unreachable") return "unreachable";
      throw e;
    }
    return versionStatus();
  }

  return { invoke, checkConnection, connect };
}
