import { test } from "node:test";
import assert from "node:assert/strict";
import { furiganaSegments } from "./furigana.js";

test("okurigana stays plain", () => {
  assert.deepEqual(furiganaSegments("食べ", "たべ"), [{ text: "食", ruby: "た" }, { text: "べ" }]);
});

test("whole-word reading", () => {
  assert.deepEqual(furiganaSegments("今日", "きょう"), [{ text: "今日", ruby: "きょう" }]);
});

test("kanji and kana mixed", () => {
  assert.deepEqual(furiganaSegments("取り扱い", "とりあつかい"), [
    { text: "取", ruby: "と" },
    { text: "り" },
    { text: "扱", ruby: "あつか" },
    { text: "い" },
  ]);
});

test("kana prefix", () => {
  assert.deepEqual(furiganaSegments("お茶", "おちゃ"), [{ text: "お" }, { text: "茶", ruby: "ちゃ" }]);
});

test("repeat mark counts as kanji", () => {
  assert.deepEqual(furiganaSegments("人々", "ひとびと"), [{ text: "人々", ruby: "ひとびと" }]);
});

test("katakana with kanji", () => {
  assert.deepEqual(furiganaSegments("サボる", "さぼる"), [{ text: "サボる" }]);
  assert.deepEqual(furiganaSegments("ヶ月", "かげつ"), [{ text: "ヶ月", ruby: "かげつ" }]);
});

test("no reading", () => {
  assert.deepEqual(furiganaSegments("カタカナ", null), [{ text: "カタカナ" }]);
});

test("no match falls back to whole word", () => {
  assert.deepEqual(furiganaSegments("食べ", "のむ"), [{ text: "食べ", ruby: "のむ" }]);
});
