// queue.js
// Cards waiting for Anki to open. Pure retry rules at the top (unit-tested);
// the IndexedDB store below is browser-only. "failed" holds items that gave
// up after repeated Anki errors, so the learner can retry them by hand.

import { fieldListChanged } from "./fieldRoles.js";

const MAX_FAILURES = 5;

// "unreachable" (Anki closed) is not the card's fault, so it isn't counted.
export function recordFailure(item, kind, message) {
  if (kind === "unreachable") return { ...item };
  return { ...item, failures: item.failures + 1, lastError: message };
}

// What a flush should do with an error from sending one card.
export function classifyFlushError(err) {
  if (err?.name !== "AnkiError") return "fatal";
  if (err.kind === "unreachable") return "unreachable";
  if (err.kind === "anki") return /duplicate/i.test(err.message) ? "done" : "failure";
  return "fatal";
}

// A queued card is stale if its note type's fields changed since it was saved.
export function checkQueuedItem(item, currentFields) {
  return item.fieldList && fieldListChanged(item.fieldList, currentFields)
    ? "Your note type changed since this card was saved."
    : null;
}

export const shouldGiveUp = (item) => item.failures >= MAX_FAILURES;

const DB_NAME = "nihongo-reader-anki";
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("queue", { keyPath: "id" });
        req.result.createObjectStore("failed", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

// Runs action(storeFn) in one transaction over the named stores.
async function run(stores, mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const result = action((name) => tx.objectStore(name));
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

export async function enqueue(note, { fieldList, base } = {}) {
  const item = {
    id: crypto.randomUUID(),
    note,
    fieldList,
    base,
    failures: 0,
    lastError: "",
    queuedAt: Date.now(),
  };
  await run("queue", "readwrite", (s) => s("queue").put(item));
  return item;
}

export const listQueue = () => run("queue", "readonly", (s) => s("queue").getAll());
export const listFailed = () => run("failed", "readonly", (s) => s("failed").getAll());
export const removeQueued = (id) => run("queue", "readwrite", (s) => s("queue").delete(id));

export const moveToFailed = (item) =>
  run(["queue", "failed"], "readwrite", (s) => {
    s("failed").put(item);
    s("queue").delete(item.id);
  });

export async function retryFailed(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["queue", "failed"], "readwrite");
    const get = tx.objectStore("failed").get(id);
    get.onsuccess = () => {
      if (!get.result) return;
      tx.objectStore("queue").put({ ...get.result, failures: 0, lastError: "" });
      tx.objectStore("failed").delete(id);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
}

// Sends queued cards oldest first. Stops at the first unreachable error.
// Overlapping calls share one run so a card is never sent twice.
let inFlight = null;
export function flushQueue(anki) {
  if (!inFlight) inFlight = doFlush(anki).finally(() => (inFlight = null));
  return inFlight;
}

async function doFlush(anki) {
  const items = (await listQueue()).sort((a, b) => a.queuedAt - b.queuedAt);
  let sent = 0;
  const fieldsByModel = new Map();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    let outcome = "done";
    let error;
    try {
      const model = item.note.modelName;
      if (!fieldsByModel.has(model)) {
        fieldsByModel.set(model, await anki.invoke("modelFieldNames", { modelName: model }));
      }
      const stale = checkQueuedItem(item, fieldsByModel.get(model));
      if (stale) {
        await moveToFailed({ ...item, lastError: stale });
        continue;
      }
      const { storeMedia = [], ...note } = item.note;
      for (const m of storeMedia) {
        await anki.invoke("storeMediaFile", { filename: m.filename, data: m.data });
      }
      await anki.invoke("addNote", { note });
    } catch (e) {
      error = e;
      outcome = classifyFlushError(e);
    }
    if (outcome === "fatal") throw error;
    if (outcome === "unreachable") return { sent, waiting: items.length - i };
    if (outcome === "done") {
      await removeQueued(item.id);
      sent++;
    } else {
      const next = recordFailure(item, "anki", error.message);
      if (shouldGiveUp(next)) await moveToFailed(next);
      else await run("queue", "readwrite", (s) => s("queue").put(next));
    }
  }
  return { sent, waiting: (await listQueue()).length };
}
