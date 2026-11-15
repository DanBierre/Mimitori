// backup.js
// Whole-app backup: saved words (with review history), known words, settings and the daily review log, as one JSON file.
// Restore writes it back to the same storage slot and reloads; store.jsx's load() fills any gaps.
// Scene stills (IndexedDB) and the Anki word cache aren't included. Anki re-syncs itself;
// stills would need base64 in the file, add them if people miss them.

// Old app name kept on purpose: renaming the key would wipe saved words and settings.
export const STORAGE_KEY = "nihongo-reader:v1";

export function toBackup(state, now = Date.now()) {
  const { words, known, settings, log } = state;
  return JSON.stringify({ app: "mimitori", version: 1, savedAt: now, words, known, settings, log });
}

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

// Returns the state to store, or throws an Error with a message fit to show the learner.
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Mimitori backup.");
  }
  if (!isObj(data) || data.app !== "mimitori") throw new Error("That file isn't a Mimitori backup.");
  if (data.version > 1) throw new Error("That backup is from a newer Mimitori. Update the app, then try again.");
  if (!isObj(data.words) || !isObj(data.known)) throw new Error("That backup looks damaged, so nothing was changed.");
  const settings = isObj(data.settings) ? data.settings : {};
  return { words: data.words, known: data.known, settings, ...(isObj(data.log) ? { log: data.log } : {}) };
}

export const backupCounts = (s) => ({ saved: Object.keys(s.words).length, known: Object.keys(s.known).length });

export function downloadBackup(state) {
  const day = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([toBackup(state)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `mimitori-backup-${day}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function restoreBackup(parsed, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(parsed));
}
