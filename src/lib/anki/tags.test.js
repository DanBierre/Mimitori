import { test } from "node:test";
import assert from "node:assert/strict";
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
  fields: { Expression: { value: word, order: 0 } },
});

function fake() {
  const calls = [];
  const returned = new Set();
  const notes = { 1: note(1, "犬", []), 2: note(2, "猫", [TAG]), 3: note(3, "鳥", []) };
  return {
    calls,
    returned,
    async invoke(action, params = {}) {
      calls.push({ action, params });
      if (action === "findNotes") {
        if (!params.query.includes("deck:Test")) return [99];
        const ids = params.query.includes("prop:") ? [] : [1, 2, 3];
        ids.forEach((i) => returned.add(i));
        return ids;
      }
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
  for (const c of a.calls.filter((c) => c.action === "findNotes")) assert.ok(c.params.query.includes("deck:Test"));
  assert.ok(!JSON.stringify(a.calls).includes("日本語一般で"));
  const writes = a.calls.filter((c) => c.action === "addTags" || c.action === "removeTags");
  assert.equal(writes.length, 2);
  for (const w of writes) {
    assert.equal(w.params.tags, TAG);
    for (const id of w.params.notes) assert.ok(a.returned.has(id));
  }
  assert.ok(a.calls.every((c) => ["findNotes", "notesInfo", "addTags", "removeTags"].includes(c.action)));
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
