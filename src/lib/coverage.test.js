import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageOf, loneNewWords, newCount } from "./coverage.js";

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

const p = (surface) => ({ surface, isWord: false });
const knownSet = (...b) => (base) => b.includes(base);

test("newCount counts each new word once", () => {
  assert.equal(newCount([w("猫"), w("猫"), w("犬"), w("は")], knownSet("は")), 2);
  assert.equal(newCount(undefined, knownSet()), 0);
});

test("loneNewWords marks the only new word in each sentence", () => {
  const tokens = [w("猫"), w("は"), w("寝る"), p("。"), w("犬"), w("鳥"), p("！"), w("魚"), w("は"), w("魚")];
  const lone = loneNewWords(tokens, knownSet("は", "寝る"));
  assert.deepEqual([...lone], [0, 7, 9]); // 猫 alone; 犬+鳥 is two new; 魚 twice is still one word
  assert.equal(loneNewWords([w("は")], knownSet("は")).size, 0);
  assert.equal(loneNewWords(null, knownSet()).size, 0);
});
