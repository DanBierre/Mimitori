import test from "node:test";
import assert from "node:assert/strict";
import { createWindower, pickRuntime } from "./windows.js";

const RATE = 16000;

// Deterministic noise (LCG), so runs are repeatable.
function noise(n, seed = 1) {
  const out = new Float32Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = ((s / 4294967296) - 0.5) * 0.2;
  }
  return out;
}

test("windows tile the audio with no gaps", () => {
  const w = createWindower({});
  const out = [];
  for (let i = 0; i < 95; i++) out.push(...w.push(noise(RATE, i + 1)));
  out.push(...w.flush());
  assert.ok(out.length >= 3);
  assert.equal(out[0].startS, 0);
  for (let i = 1; i < out.length; i++) assert.equal(out[i].startS, out[i - 1].endS);
  assert.ok(Math.abs(out.at(-1).endS - 95) < 0.01);
});

test("windower memory stays bounded", () => {
  const w = createWindower({});
  const block = noise(RATE / 2, 7);
  for (let i = 0; i < 1200; i++) {
    w.push(block);
    assert.ok(w.bufferedSeconds() <= 31);
  }
});

test("silent windows are flagged", () => {
  const w = createWindower({});
  const out = [...w.push(new Float32Array(30 * RATE)), ...w.flush()];
  assert.ok(out.length >= 1);
  assert.ok(out.every((x) => x.silent === true));
});

test("startS offsets a resumed run", () => {
  const w = createWindower({ startS: 120 });
  const out = [...w.push(noise(31 * RATE)), ...w.flush()];
  assert.equal(out[0].startS, 120);
});

test("pickRuntime", () => {
  assert.deepEqual(pickRuntime({ webgpu: true, f16: true }), {
    device: "webgpu",
    dtype: { encoder_model: "q4f16", decoder_model_merged: "q4f16" },
  });
  const q4 = { encoder_model: "q4", decoder_model_merged: "q4" };
  assert.deepEqual(pickRuntime({ webgpu: true, f16: false }), { device: "webgpu", dtype: q4 });
  assert.deepEqual(pickRuntime({ webgpu: false, f16: false }), { device: "wasm", dtype: q4 });
});
