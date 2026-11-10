import { test } from "node:test";
import assert from "node:assert/strict";
import { downmix, resample, rms, pickCut } from "./audio.js";

// Tiny seeded LCG so the noise never flakes.
function noise(n, amp, seed = 1) {
  const out = new Float32Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = (s / 0xffffffff * 2 - 1) * amp;
  }
  return out;
}

test("downmix averages two channels", () => {
  assert.deepEqual(downmix([Float32Array.of(1, 0), Float32Array.of(0, 1)]), Float32Array.of(0.5, 0.5));
});

test("resample 48k to 16k keeps duration", () => {
  assert.equal(resample(new Float32Array(48000), 48000).length, 16000);
});

test("resample 44.1k to 16k keeps duration", () => {
  assert.equal(resample(new Float32Array(44100), 44100).length, 16000);
});

test("resample keeps a slow sine's shape", () => {
  const src = new Float32Array(48000).map((_, i) => Math.sin((2 * Math.PI * 100 * i) / 48000));
  const out = resample(src, 48000);
  assert.ok(Math.abs(out[40] - Math.sin(2 * Math.PI * 100 * 0.0025)) < 0.05);
});

test("rms of silence is 0 and of ±1 square is 1", () => {
  assert.equal(rms(new Float32Array(100)), 0);
  assert.equal(rms(Float32Array.of(1, -1, 1, -1)), 1);
});

test("pickCut finds a planted gap", () => {
  const s = noise(30 * 16000, 0.5);
  s.fill(0, 28.0 * 16000, 28.2 * 16000);
  assert.ok(Math.abs(pickCut(s, 16000, 30, 3) - 28.1 * 16000) <= 1600);
});

test("pickCut on short audio returns its length", () => {
  assert.equal(pickCut(new Float32Array(160000), 16000, 30, 3), 160000);
});
