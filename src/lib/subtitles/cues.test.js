import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cueIndexAt,
  nearestCueIndex,
  nextCueIndex,
  alignOffset,
  shouldAutoPause,
  pickPrimary,
  createAutoPause,
} from "./cues.js";

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

// The pause-after-each-line loop as the player drives it: seeked() when
// playback (re)starts somewhere, seeking() on every seek, tick() each frame.
const lines = [
  { start: 1000, end: 4000, text: "一" },
  { start: 4500, end: 6000, text: "二" },
];

test("auto-pause fires once, resume carries on", () => {
  const ap = createAutoPause();
  ap.seeked(3500, 0);
  assert.equal(ap.tick(3900, 0, lines, 0), null);
  assert.equal(ap.tick(4010, -1, lines, 0), 3960); // pause, parked just inside the line
  ap.seeking(true); // the player's own park-seek
  ap.seeked(3960, 0);
  assert.equal(ap.tick(3990, 0, lines, 0), null);
  assert.equal(ap.tick(4020, -1, lines, 0), null); // resumed: no second pause on the same line
  assert.equal(ap.tick(4600, 1, lines, 0), null);
  assert.equal(ap.tick(5900, 1, lines, 0), null);
  assert.equal(ap.tick(6010, -1, lines, 0), 5960); // next line still pauses
});

test("replay after auto-pause pauses again", () => {
  const ap = createAutoPause();
  ap.seeked(3500, 0);
  ap.tick(4010, -1, lines, 0);
  ap.seeking(true);
  ap.seeked(3960, 0);
  ap.seeking(false); // learner presses Replay
  ap.seeked(1000, 0);
  assert.equal(ap.tick(1500, 0, lines, 0), null);
  assert.equal(ap.tick(3900, 0, lines, 0), null);
  assert.equal(ap.tick(4010, -1, lines, 0), 3960);
});

test("a seek across a line end never pauses", () => {
  const ap = createAutoPause();
  ap.seeked(3900, 0);
  ap.seeking(false);
  assert.equal(ap.tick(4300, -1, lines, 0), null); // timeupdate before seeked
  ap.seeked(4300, -1);
  assert.equal(ap.tick(4400, -1, lines, 0), null);
});

test("auto-pause off never pauses", () => {
  const ap = createAutoPause();
  ap.seeked(3900, 0);
  assert.equal(ap.tick(4010, -1, lines, 0, false), null);
});

test("pickPrimary", () => {
  const en = [{ start: 0, end: 1, text: "Hi" }];
  const ja = [{ start: 0, end: 1, text: "やあ" }];
  assert.deepEqual(pickPrimary(en, ja), [ja, en]);
  assert.deepEqual(pickPrimary(ja, en), [ja, en]);
  assert.deepEqual(pickPrimary(en, en), [en, en]);
});
