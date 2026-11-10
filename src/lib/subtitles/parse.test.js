import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSubtitles } from "./parse.js";

test("srt basic", () => {
  const text =
    "1\r\n00:00:01,000 --> 00:00:02,500\r\n<i>こんにちは</i>\r\n世界\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nまた";
  const { cues, skipped } = parseSubtitles(text, "a.srt");
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0], { start: 1000, end: 2500, text: "こんにちは\n世界" });
  assert.deepEqual(cues[1], { start: 3000, end: 4000, text: "また" });
  assert.equal(skipped, 0);
});

test("srt broken block", () => {
  const text = "1\n00:00:xx,000 --> 00:00:02,000\n壊れた\n\n2\n00:00:03,000 --> 00:00:04,000\n大丈夫\n";
  const { cues, skipped } = parseSubtitles(text, "a.srt");
  assert.equal(skipped, 1);
  assert.deepEqual(cues, [{ start: 3000, end: 4000, text: "大丈夫" }]);
});

test("srt end <= start is skipped", () => {
  const text = "1\n00:00:05,000 --> 00:00:04,000\n逆\n\n2\n00:00:06,000 --> 00:00:07,000\n順\n\n";
  const { cues, skipped } = parseSubtitles(text, "a.srt");
  assert.equal(skipped, 1);
  assert.equal(cues.length, 1);
});

test("vtt", () => {
  const text =
    "WEBVTT\n\nNOTE a comment\n\n00:01.000 --> 00:02.000 align:start\nやあ\n\n01:00:00.000 --> 01:00:01.000\n<c.yellow>はい</c>";
  const { cues } = parseSubtitles(text, "a.vtt");
  assert.deepEqual(cues, [
    { start: 1000, end: 2000, text: "やあ" },
    { start: 3600000, end: 3601000, text: "はい" },
  ]);
});

test("ass", () => {
  const text = [
    "[Script Info]",
    "Title: test",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    "Dialogue: 0,0:00:01.50,0:00:03.00,Default,,0,0,0,,{\\an8}行くよ、\\Nいい？",
    "Comment: 0,0:00:04.00,0:00:05.00,Default,,0,0,0,,メモ",
    "Dialogue: 0,0:00:06.00,0:00:07.00,Sign,,0,0,0,,{\\p1}m 0 0 l 100 0",
    "Dialogue: 0,0:00:08.00,0:00:09.00,Default,,0,0,0,,a, b,\\hc",
    "Dialogue: 0,0:00:10.00,0:00:11.00,Default,,0,0,0,,happy{\\i1}hour",
  ].join("\n");
  const { cues, skipped } = parseSubtitles(text, "ep1.ass");
  assert.deepEqual(cues, [
    { start: 1500, end: 3000, text: "行くよ、\nいい？" },
    { start: 8000, end: 9000, text: "a, b, c" },
    { start: 10000, end: 11000, text: "happyhour" },
  ]);
  assert.equal(skipped, 0);
});

test("sniff by content", () => {
  const { cues } = parseSubtitles("WEBVTT\n\n00:01.000 --> 00:02.000\nx", "subs.txt");
  assert.equal(cues.length, 1);
});

test("unsorted input comes back sorted", () => {
  const text = "1\n00:00:05,000 --> 00:00:06,000\n後\n\n2\n00:00:01,000 --> 00:00:02,000\n前\n";
  const { cues } = parseSubtitles(text, "a.srt");
  assert.deepEqual(cues.map((c) => c.text), ["前", "後"]);
});

test("empty text is dropped silently", () => {
  const text = "1\n00:00:01,000 --> 00:00:02,000\n<i></i>\n\n2\n00:00:03,000 --> 00:00:04,000\nある\n";
  const { cues, skipped } = parseSubtitles(text, "a.srt");
  assert.equal(cues.length, 1);
  assert.equal(skipped, 0);
});
