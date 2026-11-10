import { test } from "node:test";
import assert from "node:assert/strict";
import { sentenceSpan, sentenceAround } from "./sentence.js";

const toks = ["今日", "は", "晴れ", "。", "犬", "が", "いる", "。", "猫"].map((surface) => ({ surface }));

test("span is inclusive and stops at sentence ends", () => {
  assert.deepEqual(sentenceSpan(toks, 0), { start: 0, end: 3 });
  assert.deepEqual(sentenceSpan(toks, 5), { start: 4, end: 7 });
  assert.deepEqual(sentenceSpan(toks, 8), { start: 8, end: 8 });
});

test("sentenceAround keeps the last token", () => {
  assert.equal(sentenceAround(toks, 5), "犬がいる。");
  assert.equal(sentenceAround(toks, 8), "猫");
});
