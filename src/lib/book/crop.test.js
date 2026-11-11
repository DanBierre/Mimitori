import { test } from "node:test";
import assert from "node:assert/strict";
import { normBox, growBox, toPixels } from "./crop.js";

const close = (a, b) => {
  assert.equal(a.length, b.length);
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${a} vs ${b}`));
};

test("normBox orders corners", () => {
  close(normBox({ x: 0.5, y: 0.6 }, { x: 0.2, y: 0.1 }), [0.2, 0.1, 0.5, 0.6]);
});

test("normBox ignores tiny boxes", () => {
  assert.equal(normBox({ x: 0.2, y: 0.2 }, { x: 0.205, y: 0.5 }), null);
});

test("normBox clamps", () => {
  close(normBox({ x: -0.1, y: 0.2 }, { x: 1.3, y: 0.5 }), [0, 0.2, 1, 0.5]);
});

test("growBox grows 30% each side", () => {
  close(growBox([0.4, 0.4, 0.6, 0.6]), [0.34, 0.34, 0.66, 0.66]);
});

test("growBox clamps at corners", () => {
  close(growBox([0, 0, 0.1, 0.1]), [0, 0, 0.13, 0.13]);
});

test("toPixels rounds outward", () => {
  assert.deepEqual(toPixels([0.1, 0.1, 0.2, 0.2], 1000, 1500), { sx: 100, sy: 150, sw: 100, sh: 150 });
});
