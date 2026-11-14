import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  toBracketFurigana,
  wordFurigana,
  sentenceWithFurigana,
  boldWord,
  formatMeaning,
  formatSource,
  formatPageSource,
} from "./format.js";

test("toBracketFurigana", () => {
  assert.equal(toBracketFurigana([{ text: "食", ruby: "た" }, { text: "べる" }]), "食[た]べる");
  assert.equal(
    toBracketFurigana([
      { text: "取", ruby: "と" },
      { text: "り" },
      { text: "扱", ruby: "あつか" },
      { text: "い" },
    ]),
    "取[と]り 扱[あつか]い",
  );
  assert.equal(toBracketFurigana([{ text: "お" }, { text: "茶", ruby: "ちゃ" }]), "お 茶[ちゃ]");
  assert.equal(toBracketFurigana([{ text: "ねこ" }]), "ねこ");
});

test("wordFurigana", () => {
  assert.equal(wordFurigana("食べる", "たべる"), "食[た]べる");
  assert.equal(wordFurigana("お茶", "おちゃ"), "お 茶[ちゃ]");
});

test("boldWord", () => {
  assert.equal(boldWord("昨日は何も食べなかった。", "食べ"), "昨日は何も<b>食べ</b>なかった。");
  assert.equal(boldWord("a<b>c", "zzz"), "a&lt;b&gt;c");
});

test("escapeHtml", () => {
  assert.equal(escapeHtml("<i>a & b</i>"), "&lt;i&gt;a &amp; b&lt;/i&gt;");
});

test("formatMeaning", () => {
  assert.equal(formatMeaning(["to eat", "to live on"], "list"), "<ol><li>to eat</li><li>to live on</li></ol>");
  assert.equal(formatMeaning(["to eat", "to live on"], "plain"), "to eat; to live on");
  assert.equal(formatMeaning(["a<b"], "list"), "<ol><li>a&lt;b</li></ol>");
});

test("formatSource", () => {
  assert.equal(formatSource("ep01.mp4", 754000), "ep01.mp4 · 12:34");
  assert.equal(formatSource("ep01.mp4", 3723000), "ep01.mp4 · 1:02:03");
});

test("sentenceWithFurigana", () => {
  const tokens = [
    { surface: "食べ", segments: [{ text: "食", ruby: "た" }, { text: "べ" }] },
    { surface: "なかっ", segments: [{ text: "なかっ" }] },
    { surface: "た", segments: [{ text: "た" }] },
  ];
  assert.equal(sentenceWithFurigana(tokens, 0), "<b>食[た]べ</b>なかった");
});

test("sentenceWithFurigana spaces ruby across tokens", () => {
  const tokens = [
    { surface: "私", segments: [{ text: "私", ruby: "わたし" }] },
    { surface: "は", segments: [{ text: "は" }] },
    { surface: "食べ", segments: [{ text: "食", ruby: "た" }, { text: "べ" }] },
  ];
  assert.equal(sentenceWithFurigana(tokens, -1), "私[わたし]は 食[た]べ");
  assert.equal(sentenceWithFurigana(tokens, 2), "私[わたし]は<b>食[た]べ</b>");
});

test("brackets in plain text are encoded, furigana brackets stay", () => {
  const tokens = [
    { surface: "[音楽]", segments: [{ text: "[音楽]" }] },
    { surface: "始", segments: [{ text: "始", ruby: "はじ" }] },
  ];
  assert.equal(boldWord("[音楽]始まるよ", "始"), "&#91;音楽&#93;<b>始</b>まるよ");
  assert.equal(sentenceWithFurigana(tokens, -1), "&#91;音楽&#93; 始[はじ]");
  assert.equal(formatMeaning(["[sound:x]"], "plain"), "&#91;sound:x&#93;");
});

test("boldWord bolds the tapped occurrence when given an offset", () => {
  assert.equal(boldWord("食べて食べた", "食べ", 3), "食べて<b>食べ</b>た");
  assert.equal(boldWord("食べて食べた", "食べ", 99), "<b>食べ</b>て食べた");
});

test("formatPageSource", () => {
  assert.equal(formatPageSource("風の町 1", 12), "風の町 1, p. 12");
});

test("a word with no reading leaves the field empty, not 'undefined'", () => {
  assert.equal(escapeHtml(undefined), "");
  assert.ok(!wordFurigana("雨", undefined).includes("undefined"));
});
