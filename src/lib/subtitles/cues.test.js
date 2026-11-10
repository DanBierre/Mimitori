import { test } from "node:test";
import assert from "node:assert/strict";
import { cueIndexAt, nearestCueIndex, nextCueIndex, alignOffset, shouldAutoPause, pickPrimary } from "./cues.js";

const cues = [
  { start: 1000, end: 2000, text: "一" },
  { start: 3000, end: 4000, text: "二" },
  { start: 3500, end: 5000, text: "看板" },
];

test("cueIndexAt basic", () => {
  assert.equal(cueIndexAt(cues, 1500, 0), 0);
  assert.equal(cueIndexAt(cues, 2500, 0), -1);
  assert.equal(cueIndexAt(cues, 1500, 600), -1);
  assert.equal(cueIndexAt(cues, 1700, 600), 0);
  assert.equal(cueIndexAt(cues, 900, -200), 0);
  assert.equal(cueIndexAt(cues, 2000, 0), -1); // end is exclusive
});

test("cueIndexAt overlapping", () => {
  assert.equal(cueIndexAt(cues, 3700, 0), 2);
  assert.equal(cueIndexAt(cues, 3200, 0), 1);
});

test("nearestCueIndex gap", () => {
  assert.equal(nearestCueIndex(cues, 2500, 0), 0);
  assert.equal(nearestCueIndex(cues, 500, 0), 0);
  assert.equal(nearestCueIndex(cues, 3700, 0), 2);
  assert.equal(nearestCueIndex([], 0, 0), -1);
});

test("nextCueIndex", () => {
  assert.equal(nextCueIndex(cues, 500, 0), 0);
  assert.equal(nextCueIndex(cues, 1500, 0), 1);
  assert.equal(nextCueIndex(cues, 3200, 0), 2);
  assert.equal(nextCueIndex(cues, 9000, 0), 2); // nothing left: last line
  assert.equal(nextCueIndex(cues, 1500, 2000), 0); // subtitles 2 s late: line 1 hasn't shown yet
  assert.equal(nextCueIndex([], 0, 0), -1);
});

test("alignOffset", () => {
  // Subtitles 2 s late: learner hears line 2 (starts 3000) at 3000 → offset back to 0.
  assert.equal(alignOffset(cues[1], 3000), 0);
  // Subtitles early: line 1 heard at 1800 → +800.
  assert.equal(alignOffset(cues[0], 1800), 800);
});

test("shouldAutoPause natural", () => {
  assert.equal(shouldAutoPause(1900, 2050, cues[0], 0), true);
  assert.equal(shouldAutoPause(2400, 2550, cues[0], 500), true);
});

test("shouldAutoPause ignores seeks", () => {
  assert.equal(shouldAutoPause(1900, 4200, cues[0], 0), false);
  assert.equal(shouldAutoPause(2050, 1900, cues[0], 0), false);
  assert.equal(shouldAutoPause(1000, 1900, cues[0], 0), false);
  assert.equal(shouldAutoPause(1900, 2050, undefined, 0), false);
});

test("pickPrimary", () => {
  const en = [{ start: 0, end: 1, text: "Hi" }];
  const ja = [{ start: 0, end: 1, text: "やあ" }];
  assert.deepEqual(pickPrimary(en, ja), [ja, en]);
  assert.deepEqual(pickPrimary(ja, en), [ja, en]);
  assert.deepEqual(pickPrimary(en, en), [en, en]);
});
