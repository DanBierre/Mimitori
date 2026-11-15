import { test } from "node:test";
import assert from "node:assert/strict";
import { levelTag, parseLevels } from "./levels.js";

test("parseLevels joins JLPT level and the common mark per form", () => {
  const m = parseLevels({ jlpt: { 5: ["猫"], 2: ["概念"] }, common: ["猫", "の"] });
  assert.deepEqual(m.get("猫"), { jlpt: 5, common: true });
  assert.deepEqual(m.get("の"), { jlpt: 0, common: true });
  assert.deepEqual(m.get("概念"), { jlpt: 2, common: false });
  assert.equal(parseLevels().size, 0);
});

test("levelTag shows the level and the common mark", () => {
  assert.equal(levelTag({ jlpt: 5, common: true }), "N5 · common");
  assert.equal(levelTag({ jlpt: 1, common: false }), "N1");
  assert.equal(levelTag({ jlpt: 0, common: true }), "common");
  assert.equal(levelTag(undefined), "");
});
