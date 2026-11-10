import { test } from "node:test";
import assert from "node:assert/strict";
import { deckQuery } from "./known.js";
import { planTags, syncTags, TAG } from "./tags.js";

test("planTags adds to known words without the tag and removes from words no longer known", () => {
  const notes = [
    { noteId: 1, word: "犬", tags: [] },
    { noteId: 2, word: "猫", tags: [TAG] },
    { noteId: 3, word: "鳥", tags: [] },
  ];
  assert.deepEqual(planTags(notes, { 犬: true }), { add: [1], remove: [2] });
});

test("planTags matches the tag case-insensitively", () => {
  const notes = [{ noteId: 1, word: "犬", tags: ["MIMITORI-KNOWN"] }];
  assert.deepEqual(planTags(notes, { 犬: true }), { add: [], remove: [] });
});

const MAPPING = { Expression: { role: "expression" } };
const note = (id, word, tags) => ({
  noteId: id,
  modelName: "M",
  tags,
  cards: [id],
  fields: { Expression: { value: word, order: 0 } },
});

function fake(extra) {
  const calls = [];
  const returned = new Set();
  const notes = { 1: note(1, "犬", []), 2: note(2, "猫", [TAG]), 3: note(3, "鳥", []) };
  if (extra) notes[4] = { ...note(4, "鼠", []), cards: [4, 99] };
  return {
    calls,
    returned,
    async invoke(action, params = {}) {
      calls.push({ action, params });
      if (action === "findNotes") {
        if (!params.query.startsWith('"deck:Test"')) return [99];
        const ids = params.query.includes("prop:") ? [] : extra ? [1, 2, 3, 4] : [1, 2, 3];
        ids.forEach((i) => returned.add(i));
        return ids;
      }
      if (action === "findCards") return params.query === '"deck:Test"' ? [1, 2, 3, 4] : [99];
      if (action === "notesInfo") return params.notes.map((i) => notes[i]);
      return null;
    },
  };
}

const settings = { deck: "Test", model: "M", mapping: MAPPING, readDecks: ["日本語一般で"] };

test("syncTags only reads and tags the add-to deck", async () => {
  const a = fake();
  const r = await syncTags(a, settings, { 犬: true });
  assert.deepEqual(r, { added: 1, removed: 1 });
  for (const c of a.calls.filter((c) => c.action === "findNotes" || c.action === "findCards"))
    assert.ok(['"deck:Test"', '"deck:Test" prop:ivl>=21'].includes(c.params.query));
  assert.ok(!JSON.stringify(a.calls).includes("日本語一般で"));
  const writes = a.calls.filter((c) => c.action === "addTags" || c.action === "removeTags");
  assert.equal(writes.length, 2);
  for (const w of writes) {
    assert.equal(w.params.tags, TAG);
    for (const id of w.params.notes) assert.ok(a.returned.has(id));
  }
  assert.ok(a.calls.every((c) => ["findNotes", "findCards", "notesInfo", "addTags", "removeTags"].includes(c.action)));
});

test("syncTags makes no write calls when nothing changes", async () => {
  const a = fake();
  const r = await syncTags(a, settings, { 犬: true, 猫: true, 鳥: true });
  assert.deepEqual(r, { added: 2, removed: 0 });
  const b = fake();
  const r2 = await syncTags(b, settings, { 猫: true });
  assert.deepEqual(r2, { added: 0, removed: 0 });
  assert.ok(!b.calls.some((c) => c.action === "addTags" || c.action === "removeTags"));
});

test("syncTags does nothing without an add-to deck", async () => {
  const a = fake();
  assert.deepEqual(await syncTags(a, { ...settings, deck: "" }, { 犬: true }), { added: 0, removed: 0 });
  assert.equal(a.calls.length, 0);
});

test("syncTags leaves notes with a card outside the add-to deck alone", async () => {
  const a = fake(true);
  await syncTags(a, settings, { 鼠: true, 犬: true });
  const tagged = a.calls.filter((c) => c.action === "addTags" || c.action === "removeTags").flatMap((c) => c.params.notes);
  assert.ok(tagged.includes(1));
  assert.ok(!tagged.includes(4));
});

test("planTags ignores prototype names", () => {
  assert.deepEqual(planTags([{ noteId: 1, word: "constructor", tags: [] }], {}), { add: [], remove: [] });
});

test("deckQuery escapes Anki wildcards", () => {
  assert.equal(deckQuery("A_B"), '"deck:A\\_B"');
  assert.equal(deckQuery('x*"y'), '"deck:x\\*\\"y"');
  assert.equal(deckQuery("日本語一般で"), '"deck:日本語一般で"');
});
