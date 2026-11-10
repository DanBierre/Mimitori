import { test } from "node:test";
import assert from "node:assert/strict";
import { toCues, dropJunk } from "./clean.js";

test("toCues offsets by window start", () => {
  assert.deepEqual(toCues(60, 90, [{ text: " 何? ", timestamp: [1.5, 2.25] }]), [
    { start: 61500, end: 62250, text: "何?" },
  ]);
});

test("toCues fills a missing end with the window end", () => {
  assert.equal(toCues(60, 90, [{ text: "あ", timestamp: [5, null] }])[0].end, 90000);
});

test("dropJunk removes thanks-for-watching hallucination", () => {
  const cues = [{ start: 0, end: 1000, text: "ご視聴ありがとうございました" }];
  assert.deepEqual(dropJunk(cues), []);
});

test("dropJunk removes punctuation-only lines", () => {
  const cues = [
    { start: 0, end: 1000, text: "…" },
    { start: 1000, end: 2000, text: "！？" },
  ];
  assert.deepEqual(dropJunk(cues), []);
});

test("dropJunk keeps real short lines", () => {
  const cues = [
    { start: 0, end: 1000, text: "ねっ" },
    { start: 1000, end: 2000, text: "何？" },
  ];
  assert.deepEqual(dropJunk(cues), cues);
});

test("dropJunk removes sound tags and music marks, keeps real lines", () => {
  const kept = dropJunk(["音楽", "(音楽)", "♪～", "音楽が好き"].map((text) => ({ start: 0, end: 1, text })));
  assert.deepEqual(kept.map((c) => c.text), ["音楽が好き"]);
});

test("toCues clamps end to [start, window end]", () => {
  const [a, b] = toCues(10, 40, [
    { timestamp: [5, 3], text: "a" },
    { timestamp: [5, 99], text: "b" },
  ]);
  assert.equal(a.end, 15000);
  assert.equal(b.end, 40000);
});
