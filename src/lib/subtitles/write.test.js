import { test } from "node:test";
import assert from "node:assert/strict";
import { writeSrt } from "./write.js";
import { parseSubtitles } from "./parse.js";

const cues = [
  { start: 1000, end: 2500, text: "こんにちは\n世界" },
  { start: 3600000, end: 3601000, text: "また" },
];

test("writeSrt round trip", () => {
  assert.deepEqual(parseSubtitles(writeSrt(cues, 0), "x.srt").cues, cues);
});

test("writeSrt offset", () => {
  const out = writeSrt([{ start: 1000, end: 2000, text: "a" }], 500);
  assert.match(out, /^1\n00:00:01,500 --> 00:00:02,500\na\n/);
});

test("writeSrt clamps negative times", () => {
  const out = writeSrt(
    [
      { start: 0, end: 1000, text: "a" },
      { start: 2000, end: 3000, text: "b" },
    ],
    -1500
  );
  assert.equal(out, "1\n00:00:00,500 --> 00:00:01,500\nb\n");
  const clamped = writeSrt([{ start: 1000, end: 3000, text: "c" }], -1500);
  assert.match(clamped, /00:00:00,000 --> 00:00:01,500/);
});
