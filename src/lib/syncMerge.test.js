import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeState } from "./syncMerge.js";

const word = (base, addedAt, extra = {}) => ({ base, addedAt, card: { due: addedAt }, ...extra });

test("words from both devices are kept", () => {
  const m = mergeState({ words: { 猫: word("猫", 1) } }, { words: { 犬: word("犬", 2) } });
  assert.deepEqual(Object.keys(m.words).sort(), ["犬", "猫"]);
});

test("the most recently reviewed copy of a word wins", () => {
  const old = word("猫", 1, { card: { due: 5, last_review: new Date(10).toISOString() } });
  const fresh = word("猫", 1, { card: { due: 9, last_review: new Date(20).toISOString() } });
  assert.equal(mergeState({ words: { 猫: old } }, { words: { 猫: fresh } }).words.猫, fresh);
  assert.equal(mergeState({ words: { 猫: fresh } }, { words: { 猫: old } }).words.猫, fresh);
});

test("a removed word stays removed", () => {
  const m = mergeState({ words: {}, gone: { 猫: 5 } }, { words: { 猫: word("猫", 1) } });
  assert.equal(m.words.猫, undefined);
  assert.equal(m.gone.猫, 5);
});

test("a word saved again after removing comes back", () => {
  const m = mergeState({ words: { 猫: word("猫", 9) } }, { words: {}, gone: { 猫: 5 } });
  assert.ok(m.words.猫);
});

test("a word put back with Undo beats its removal", () => {
  const m = mergeState({ words: { 猫: word("猫", 1, { touched: 9 }) } }, { gone: { 猫: 5 } });
  assert.ok(m.words.猫);
});

test("un-knowing a word sticks", () => {
  assert.deepEqual(mergeState({ goneKnown: { 猫: 8 } }, { known: { 猫: 3 } }).known, {});
  assert.deepEqual(mergeState({ known: { 猫: 9 } }, { goneKnown: { 猫: 8 } }).known, { 猫: 9 });
});

test("saving a known word again to study it drops it from known", () => {
  const m = mergeState({ words: { 猫: word("猫", 9) } }, { known: { 猫: 3 } });
  assert.deepEqual(m.known, {});
});

test("a word graded into known keeps both", () => {
  const w = word("猫", 1, { card: { due: 99, last_review: new Date(5).toISOString() } });
  const m = mergeState({ words: { 猫: w }, known: { 猫: 5 } }, {});
  assert.ok(m.words.猫);
  assert.equal(m.known.猫, 5);
});

test("old known entries saved as true still merge", () => {
  assert.deepEqual(mergeState({ known: { 猫: true } }, { known: { 犬: 2 } }).known, { 猫: true, 犬: 2 });
});

test("the higher review count for a day wins", () => {
  assert.deepEqual(mergeState({ log: { "2026-11-16": 3 } }, { log: { "2026-11-16": 5, "2026-11-15": 2 } }).log,
    { "2026-11-16": 5, "2026-11-15": 2 });
});

test("newer settings win, but Anki setup stays on this device", () => {
  const mine = { settings: { theme: "light", anki: { deck: "Test" } }, settingsAt: 1 };
  const theirs = { settings: { theme: "dark", anki: { deck: "Other" } }, settingsAt: 2 };
  const m = mergeState(mine, theirs);
  assert.equal(m.settings.theme, "dark");
  assert.equal(m.settings.anki.deck, "Test");
  assert.equal(m.settingsAt, 2);
  assert.equal(mergeState(theirs, mine).settings.theme, "dark");
});

test("merging is the same both ways round and settles", () => {
  const a = { words: { 猫: word("猫", 1), 鳥: word("鳥", 4) }, gone: { 犬: 7 }, known: { 魚: 2 } };
  const b = { words: { 犬: word("犬", 3), 鳥: word("鳥", 4, { touched: 6 }) }, goneKnown: { 魚: 1 } };
  const ab = mergeState(a, b);
  assert.deepEqual(Object.keys(ab.words).sort(), Object.keys(mergeState(b, a).words).sort());
  assert.deepEqual(mergeState(ab, b), ab);
  assert.equal(ab.words.犬, undefined);
  assert.equal(ab.words.鳥.touched, 6);
});

test("no copy on the server yet", () => {
  const m = mergeState({ words: { 猫: word("猫", 1) } }, null);
  assert.ok(m.words.猫);
});
