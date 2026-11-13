import { test } from "node:test";
import assert from "node:assert/strict";
import { deckQuery, deckOnlyQuery, mergeDeckNotes } from "./known.js";
import { planTags, syncTags, planSuspend, syncSuspend, TAG, SUSPEND_TAG } from "./tags.js";

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

function fake(extra, suspended = [], tags = {}) {
  const calls = [];
  const returned = new Set();
  const notes = { 1: note(1, "犬", tags[1] ?? []), 2: note(2, "猫", tags[2] ?? [TAG]), 3: note(3, "鳥", tags[3] ?? []) };
  if (extra) notes[4] = { ...note(4, "鼠", []), cards: [4, 99] };
  if (extra) notes[5] = { ...note(5, "象", []), cards: [5] }; // only in Test::Child
  return {
    calls,
    returned,
    async invoke(action, params = {}) {
      calls.push({ action, params });
      if (action === "findNotes") {
        if (!params.query.startsWith('"deck:Test"')) return [99];
        const ids = params.query.includes("prop:") ? [] : extra ? [1, 2, 3, 4, 5] : [1, 2, 3];
        ids.forEach((i) => returned.add(i));
        return ids;
      }
      if (action === "findCards") {
        if (params.query.endsWith("is:suspended")) return suspended;
        return params.query === '"deck:Test" -"deck:Test::*"' ? [1, 2, 3, 4] : [99];
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
  for (const c of a.calls.filter((c) => c.action === "findNotes" || c.action === "findCards"))
    assert.ok(['"deck:Test"', '"deck:Test" prop:ivl>=21', '"deck:Test" -"deck:Test::*"', '"deck:Test" is:suspended'].includes(c.params.query));
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
  assert.ok(!tagged.includes(5)); // subdeck-only note is never touched
  assert.equal(a.calls.filter((c) => c.action === "findCards").at(-1).params.query, '"deck:Test" -"deck:Test::*"');
});

test("deckOnlyQuery escapes the name but keeps ::* a wildcard", () => {
  assert.equal(deckOnlyQuery("A_B"), '"deck:A\\_B" -"deck:A\\_B::*"');
});

test("mergeDeckNotes keeps missing-deck notes and replaces the rest", () => {
  const gone = "X wasn't found in Anki";
  assert.deepEqual(mergeDeckNotes([gone, "Couldn't find the word field in Y"], ["Couldn't find the word field in Z"]), [gone, "Couldn't find the word field in Z"]);
  assert.deepEqual(mergeDeckNotes([gone], [gone]), [gone]);
});

test("planTags ignores prototype names", () => {
  assert.deepEqual(planTags([{ noteId: 1, word: "constructor", tags: [] }], {}), { add: [], remove: [] });
});

test("deckQuery escapes Anki wildcards", () => {
  assert.equal(deckQuery("A_B"), '"deck:A\\_B"');
  assert.equal(deckQuery('x*"y'), '"deck:x\\*\\"y"');
  assert.equal(deckQuery("日本語一般で"), '"deck:日本語一般で"');
});

const N = (noteId, word, tags, cards) => ({ noteId, word, tags, cards });

test("planSuspend covers each case", () => {
  const notes = [
    N(1, "a", [], [1]), // known, untagged -> suspend
    N(2, "b", [SUSPEND_TAG], [2]), // known, tagged, suspended -> nothing
    N(3, "c", [SUSPEND_TAG], [3, 4]), // known, tagged, one card unsuspended -> Anki wins
    N(4, "d", [SUSPEND_TAG], [5]), // not known, tagged -> unsuspend
    N(5, "e", [], [6]), // not known, untagged -> never touched
    N(6, "f", [TAG], [7]), // mimitori-known tag is not ours
  ];
  const p = planSuspend(notes, { a: true, b: true, c: true, f: true }, new Set([2, 3]));
  assert.deepEqual(p.suspend.map((n) => n.noteId), [1, 6]);
  assert.deepEqual(p.unsuspend.map((n) => n.noteId), [4]);
  assert.deepEqual(p.untag, [3, 4]);
  assert.deepEqual(p.unknow, ["c"]);
});

test("syncSuspend suspends then tags, unsuspends then untags, in the add-to deck only", async () => {
  const a = fake(false, [2], { 1: [], 2: [SUSPEND_TAG], 3: [] });
  const r = await syncSuspend(a, settings, { 犬: true });
  assert.deepEqual(r, { suspended: 1, unsuspended: 1, unknow: [], words: { 犬: "known", 猫: "inDeck" } });
  const w = a.calls.filter((c) => ["suspend", "unsuspend", "addTags", "removeTags"].includes(c.action));
  assert.deepEqual(w.map((c) => c.action), ["suspend", "addTags", "unsuspend", "removeTags"]);
  assert.deepEqual(w[0].params, { cards: [1] });
  assert.deepEqual(w[1].params, { notes: [1], tags: SUSPEND_TAG });
  assert.deepEqual(w[2].params, { cards: [2] });
  assert.ok(!JSON.stringify(a.calls).includes("日本語一般で"));
});

test("syncSuspend: unsuspended in Anki wins and reports the word; subdeck notes are skipped", async () => {
  const a = fake(true, [], { 1: [SUSPEND_TAG], 2: [], 3: [] });
  const r = await syncSuspend(a, settings, { 犬: true, 鼠: true });
  assert.deepEqual(r.unknow, ["犬"]);
  assert.ok(!a.calls.some((c) => c.action === "suspend" || c.action === "unsuspend"));
  const touched = a.calls.filter((c) => c.action === "addTags" || c.action === "removeTags").flatMap((c) => c.params.notes);
  assert.ok(!touched.includes(4) && !touched.includes(5));
});
