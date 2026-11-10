// Saved transcripts, one per video, in IndexedDB. Failures resolve quietly: a lost save isn't worth an error.

const DB = "mimitori-transcripts";
const STORE = "transcripts";

export function openTranscripts() {
  const opened = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const run = (mode, fn) =>
    opened.then(
      (db) =>
        new Promise((resolve, reject) => {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );
  return {
    async getTranscript(key) {
      try {
        return (await run("readonly", (s) => s.get(key))) ?? null;
      } catch {
        return null;
      }
    },
    async putTranscript(key, record) {
      try {
        await run("readwrite", (s) => s.put(record, key));
      } catch {
        /* nothing to do */
      }
    },
  };
}
