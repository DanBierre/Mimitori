import { test } from "node:test";
import assert from "node:assert/strict";
import { textInBox } from "./textInBox.js";

const it = (str, box, vertical = false) => ({ str, box, vertical });
const ALL = [0, 0, 1, 1];

test("horizontal rows read top to bottom, left to right", () => {
  const items = [
    it("です", [0.3, 0.1, 0.4, 0.15]),
    it("これは", [0.1, 0.1, 0.29, 0.15]),
    it("ペン", [0.1, 0.2, 0.2, 0.25]),
  ];
  assert.equal(textInBox(items, ALL), "これはですペン");
});

test("vertical columns read right to left, top to bottom", () => {
  const items = [
    it("来た", [0.6, 0.31, 0.65, 0.4], true),
    it("のか…", [0.5, 0.1, 0.55, 0.3], true),
    it("本当に", [0.6, 0.1, 0.65, 0.3], true),
  ];
  assert.equal(textInBox(items, ALL), "本当に来たのか…");
});

test("only items whose centre is inside", () => {
  const items = [
    it("中", [0.2, 0.2, 0.3, 0.3]),
    it("外", [0.45, 0.2, 0.65, 0.3]), // centre x 0.55, outside a box ending at 0.5
  ];
  assert.equal(textInBox(items, [0, 0, 0.5, 1]), "中");
});

test("empty box gives empty string", () => {
  assert.equal(textInBox([it("あ", [0.8, 0.8, 0.9, 0.9])], [0, 0, 0.2, 0.2]), "");
  assert.equal(textInBox([], ALL), "");
});
