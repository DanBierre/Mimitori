// cues.js
// Time maths for the Watch tab. All times in ms; `offset` shifts every cue
// (positive = subtitles later).
// Linear scans, fine for ~1,000 cues; binary search if files get huge.

import { JAPANESE_REGEX } from "../furigana.js";

// Active cue at time t. When lines overlap (a sign over dialogue), the one
// that started last wins. -1 when nothing is showing.
export function cueIndexAt(cues, t, offset) {
  let found = -1;
  for (let i = 0; i < cues.length; i++) {
    const start = cues[i].start + offset;
    if (start > t) break;
    if (t < cues[i].end + offset && (found === -1 || cues[i].start >= cues[found].start)) found = i;
  }
  return found;
}

// The line replay/prev/next work from: the active one, else the last one that
// started, else the first.
export function nearestCueIndex(cues, t, offset) {
  if (!cues.length) return -1;
  const active = cueIndexAt(cues, t, offset);
  if (active !== -1) return active;
  let last = 0;
  for (let i = 0; i < cues.length; i++) {
    if (cues[i].start + offset <= t) last = i;
    else break;
  }
  return last;
}

// The next line still to appear (with the current offset), else the last one.
// "Line up a line" freezes this as its target, so it works for subtitles that
// are early or late.
export function nextCueIndex(cues, t, offset) {
  if (!cues.length) return -1;
  const i = cues.findIndex((c) => c.start + offset > t);
  return i === -1 ? cues.length - 1 : i;
}

// Offset that makes `cue` start at time t (when the learner heard it).
export const alignOffset = (cue, t) => t - cue.start;

// True only when normal playback just crossed the end of `cue`. A jump of a
// second or more (seek, prev/next) or going backwards never counts.
export function shouldAutoPause(prev, now, cue, offset) {
  if (!cue) return false;
  const end = cue.end + offset;
  const step = now - prev;
  return step > 0 && step < 1000 && prev < end && end <= now;
}

const japaneseCount = (cues) => cues.filter((c) => JAPANESE_REGEX.test(c.text)).length;

// Two subtitle files: the more Japanese one becomes the main line.
export function pickPrimary(a, b) {
  return japaneseCount(b) > japaneseCount(a) ? [b, a] : [a, b];
}
