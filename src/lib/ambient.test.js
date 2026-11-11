import test from "node:test";
import assert from "node:assert/strict";
import { ambientColours, averageColumns, soften } from "./ambient.js";

const frame = (w, h, px) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d.set([...px(x, y), 255], (y * w + x) * 4);
  return d;
};

test("averages the columns", () => {
  const d = frame(4, 2, (x) => (x < 2 ? [100, 0, 0] : [200, 0, 0]));
  assert.deepEqual(averageColumns(d, 4, 2, 0, 4), [150, 0, 0]);
});

test("ignores near-black letterbox pixels", () => {
  const d = frame(4, 1, (x) => (x === 0 ? [2, 2, 2] : [90, 120, 60]));
  assert.deepEqual(averageColumns(d, 4, 1, 0, 4), [90, 120, 60]);
});

test("an all-black side gives no glow", () => {
  const d = frame(4, 1, () => [0, 0, 0]);
  assert.equal(averageColumns(d, 4, 1, 0, 2), null);
  assert.deepEqual(ambientColours(d, 4, 1), { l: "transparent", r: "transparent" });
});

test("clamps saturation and brightness", () => {
  const [, g] = soften([255, 0, 0]);
  assert.ok(g > 0);
  assert.ok(Math.max(...soften([255, 255, 255])) <= 155);
  assert.ok(Math.min(...soften([40, 40, 40])) >= 70);
});

test("splits left and right", () => {
  const d = frame(4, 1, (x) => (x < 2 ? [200, 60, 60] : [60, 60, 200]));
  const { l, r } = ambientColours(d, 4, 1);
  assert.match(l, /^rgb\(/);
  assert.notEqual(l, r);
});
