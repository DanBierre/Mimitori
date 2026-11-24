import test from "node:test";
import assert from "node:assert/strict";
import { toBackup, parseBackup, restoreBackup, backupCounts, STORAGE_KEY } from "./backup.js";

const state = {
  words: { 犬: { base: "犬", card: { due: 1 } } },
  known: { 猫: 123 },
  settings: { ink: "indigo", anki: { deck: "Test" } },
  anki: { known: { 鳥: true }, inDeck: {}, syncedAt: 5, deckNotes: [] },
};

test("round trip keeps words, known and settings, and leaves the Anki cache out", () => {
  const back = parseBackup(toBackup(state, 1));
  assert.deepEqual(back, { words: state.words, known: state.known, settings: state.settings });
  assert.deepEqual(backupCounts(back), { saved: 1, known: 1 });
});

test("rejects junk, other apps, newer versions and damaged files", () => {
  assert.throws(() => parseBackup("not json"), /isn't a Mimitori backup/);
  assert.throws(() => parseBackup('{"app":"other"}'), /isn't a Mimitori backup/);
  assert.throws(() => parseBackup('{"app":"mimitori","version":2,"words":{},"known":{}}'), /newer Mimitori/);
  assert.throws(() => parseBackup('{"app":"mimitori","version":1,"words":[],"known":{}}'), /damaged/);
});

test("missing settings restore as empty, so the app's defaults fill in", () => {
  assert.deepEqual(parseBackup('{"app":"mimitori","version":1,"words":{},"known":{}}').settings, {});
});

test("restore writes to the app's storage slot", () => {
  const m = new Map();
  restoreBackup(parseBackup(toBackup(state)), { setItem: (k, v) => m.set(k, v) });
  assert.deepEqual(JSON.parse(m.get(STORAGE_KEY)).known, state.known);
});

test("round trip keeps the deletion notes so sync doesn't bring deleted words back", () => {
  const withGone = { ...state, gone: { 虎: 50 }, goneKnown: { 象: 60 } };
  const back = parseBackup(toBackup(withGone, 1));
  assert.deepEqual(back.gone, { 虎: 50 });
  assert.deepEqual(back.goneKnown, { 象: 60 });
});
