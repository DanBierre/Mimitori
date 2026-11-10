import { test } from "node:test";
import assert from "node:assert/strict";
import { transcriptKey, emptyRecord, initialState, reduce } from "./state.js";

const cue = (start, end, text) => ({ start, end, text });
const started = (task = "transcribe", jobId = 1) => reduce(initialState, { type: "start", jobId, task });
const msg = (state, m) => reduce(state, { type: "worker", msg: m });

test("transcriptKey joins name, size, lastModified", () => {
  assert.equal(transcriptKey({ name: "a.mp4", size: 10, lastModified: 5 }), "a.mp4|10|5");
});

test("cues append in order and advance doneS", () => {
  let s = started();
  s = msg(s, { type: "cues", jobId: 1, cues: [cue(0, 1, "a")], doneS: 30, totalS: 100 });
  s = msg(s, { type: "cues", jobId: 1, cues: [cue(31, 32, "b")], doneS: 60, totalS: 100 });
  assert.deepEqual(s.record.ja.map((c) => c.text), ["a", "b"]);
  assert.equal(s.record.doneS, 60);
  assert.equal(s.progressS, 60);
});

test("stale jobId messages are ignored", () => {
  const s = started("transcribe", 2);
  const next = msg(s, { type: "cues", jobId: 1, cues: [cue(0, 1, "x")], doneS: 30, totalS: 100 });
  assert.equal(next.record, s.record);
});

test("edit replaces text and marks the line edited", () => {
  let s = started();
  s = msg(s, { type: "cues", jobId: 1, cues: [cue(0, 1, "a")], doneS: 30, totalS: 100 });
  s = reduce(s, { type: "edit", index: 0, text: "fixed" });
  assert.equal(s.record.ja[0].text, "fixed");
  assert.deepEqual(s.record.edited, [0]);
});

test("edits survive a resumed run", () => {
  const record = { ...emptyRecord(), ja: [cue(0, 1, "mine")], edited: [0], doneS: 30, totalS: 100 };
  let s = reduce(initialState, { type: "load", record });
  s = reduce(s, { type: "start", jobId: 1, task: "transcribe" });
  s = msg(s, { type: "cues", jobId: 1, cues: [cue(31, 32, "later")], doneS: 60, totalS: 100 });
  assert.equal(s.record.ja[0].text, "mine");
  assert.deepEqual(s.record.edited, [0]);
  assert.equal(s.record.ja.length, 2);
});

test("translate cues go to record.en and leave ja untouched", () => {
  const record = { ...emptyRecord(), ja: [cue(0, 1, "a")], doneS: 30, totalS: 100, done: true };
  let s = reduce(initialState, { type: "load", record });
  s = reduce(s, { type: "start", jobId: 2, task: "translate" });
  s = msg(s, { type: "cues", jobId: 2, cues: [cue(0, 1, "hello")], doneS: 20, totalS: 100 });
  assert.deepEqual(s.record.en.map((c) => c.text), ["hello"]);
  assert.equal(s.record.ja, record.ja);
  assert.equal(s.record.doneS, 30);
  assert.equal(s.progressS, 20);
});

test("error message sets status error with its code", () => {
  const s = msg(started(), { type: "error", jobId: 1, code: "no-audio", message: "nope" });
  assert.equal(s.status, "error");
  assert.equal(s.error.code, "no-audio");
});
