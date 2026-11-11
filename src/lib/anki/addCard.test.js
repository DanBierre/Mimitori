import { test } from "node:test";
import assert from "node:assert/strict";
import { addCardFromWord } from "./addCard.js";
import { AnkiError } from "./connect.js";

const mapping = {
  Word: { role: "expression", format: null },
  Pic: { role: "picture", format: null },
  Audio: { role: "sentenceAudio", format: null },
};
const settings = { deck: "Test", model: "M", mapping, fieldList: ["Word", "Pic", "Audio"] };
const word = { base: "犬", surface: "犬", reading: "いぬ", glosses: ["dog"] };
const cue = { start: 1000, end: 2000 };
const blob = () => new Blob([new Uint8Array(2000)]);

const tpl = { ...settings, mapping: { Word: { role: "expression" }, Back: { role: "template", template: "{picture}{sentenceAudio}" } }, fieldList: ["Word", "Back"] };
const tplSetup = (o = {}) => ({ settings: tpl, ...o, invoke: (a, p) => (a === "modelFieldNames" ? ["Word", "Back"] : o.invoke?.(a, p)) });

function setup({ invoke, deps = {}, ...args } = {}) {
  const calls = [];
  const anki = {
    invoke: async (action, params) => {
      calls.push({ action, params });
      if (invoke) {
        const r = invoke(action, params);
        if (r !== undefined) return r;
      }
      return action === "modelFieldNames" ? ["Word", "Pic", "Audio"] : 1;
    },
  };
  const queued = [];
  const progress = [];
  const rec = [];
  const fakeDeps = {
    captureFrame: async () => blob(),
    recordLine: async (...a) => (rec.push(a), blob()),
    enqueue: async (n) => queued.push(n),
    now: () => 42,
    ...deps,
  };
  const run = (extra = {}) =>
    addCardFromWord({ anki, settings, word, video: {}, cue, offsetMs: 100, onProgress: (p) => progress.push(p), deps: fakeDeps, ...args, ...extra });
  return { run, calls, queued, progress, rec };
}

const actions = (calls) => calls.map((c) => c.action);

test("added: media stored before addNote and stripped from the note", async () => {
  const t = setup();
  assert.equal(await t.run(), "added");
  assert.deepEqual(actions(t.calls).filter((a) => a !== "modelFieldNames"), ["addNote"]);
  const note = t.calls.find((c) => c.action === "addNote").params.note;
  assert.equal(note.storeMedia, undefined);
  assert.equal(note.picture.length, 1);
  assert.equal(note.audio.length, 1);
  assert.deepEqual(t.rec[0], [{}, 1100, 2100]);
  assert.deepEqual(t.progress, ["recording"]);
});

test("template media is sent with storeMediaFile before addNote", async () => {
  const t = setup(tplSetup());
  assert.equal(await t.run(), "added");
  const a = actions(t.calls);
  assert.deepEqual(a.slice(-3), ["storeMediaFile", "storeMediaFile", "addNote"]);
  assert.equal(t.calls.at(-1).params.note.storeMedia, undefined);
});

test("duplicate via maps: nothing recorded or sent", async () => {
  const t = setup({ maps: { known: {}, inDeck: { 犬: true } } });
  assert.equal(await t.run(), "duplicate");
  assert.equal(t.rec.length, 0);
  assert.deepEqual(actions(t.calls), ["modelFieldNames"]);
});

test("duplicate via Anki error", async () => {
  const t = setup({ invoke: (a) => { if (a === "addNote") throw new AnkiError("cannot create note because it is a duplicate", "anki"); } });
  assert.equal(await t.run(), "duplicate");
});

test("changed field list: nothing added", async () => {
  const t = setup({ invoke: (a) => (a === "modelFieldNames" ? ["Word", "Extra"] : undefined) });
  assert.equal(await t.run(), "changed");
  assert.deepEqual(actions(t.calls), ["modelFieldNames"]);
  assert.equal(t.queued.length, 0);
});

test("unreachable up front: queued with storeMedia kept", async () => {
  const t = setup(tplSetup({ invoke: () => { throw new AnkiError("down", "unreachable"); } }));
  assert.equal(await t.run(), "queued");
  assert.equal(t.queued.length, 1);
  assert.equal(t.queued[0].storeMedia.length, 2);
});

test("unreachable on addNote: queued with storeMedia kept", async () => {
  const t = setup(tplSetup({ invoke: (a) => { if (a === "storeMediaFile") throw new AnkiError("down", "unreachable"); } }));
  assert.equal(await t.run(), "queued");
  assert.equal(t.queued[0].storeMedia.length, 2);
});

test("audio fails: still added, noAudio reported", async () => {
  const t = setup({ deps: { recordLine: async () => null } });
  assert.equal(await t.run(), "added");
  assert.deepEqual(t.progress, ["recording", "noAudio"]);
  const note = t.calls.find((c) => c.action === "addNote").params.note;
  assert.equal(note.audio, undefined);
  assert.equal(note.picture.length, 1);
});

test("Read save (no video): no media calls", async () => {
  const t = setup({ video: undefined, cue: undefined });
  assert.equal(await t.run({ video: undefined, cue: undefined }), "added");
  assert.deepEqual(actions(t.calls), ["modelFieldNames", "addNote"]);
  assert.deepEqual(t.progress, []);
});

test("other Anki error is returned", async () => {
  const t = setup({ invoke: (a) => { if (a === "addNote") throw new AnkiError("model not found", "anki"); } });
  assert.deepEqual(await t.run(), { error: "model not found" });
});

test("uses a given picture instead of a video frame", async () => {
  const t = setup({
    video: undefined,
    cue: undefined,
    picture: new Blob([new Uint8Array([1, 2, 3])]),
    deps: { captureFrame: async () => { throw new Error("should not capture"); } },
  });
  assert.equal(await t.run(), "added");
  const note = t.calls.find((c) => c.action === "addNote").params.note;
  assert.equal(note.picture.length, 1);
  assert.match(note.picture[0].filename, /\.jpg$/);
});
