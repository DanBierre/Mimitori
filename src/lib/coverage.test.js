import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageOf } from "./coverage.js";

const w = (base) => ({ base, isWord: true });
const known = new Set(["猫", "犬", "見る"]);
const isKnown = (b) => known.has(b);

test("counts only words, across every line", () => {
  const lines = [[w("猫"), { base: "は", isWord: false }, w("走る")], [w("犬"), w("見る")]];
  assert.equal(coverageOf(lines, isKnown), 75);
});

test("no words gives null, not 0%", () => {
  assert.equal(coverageOf([], isKnown), null);
  assert.equal(coverageOf([[{ base: "。", isWord: false }], undefined], isKnown), null);
});
