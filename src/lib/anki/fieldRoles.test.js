import test from "node:test";
import assert from "node:assert/strict";
import { ROLES, guessFieldRoles, fieldListChanged } from "./fieldRoles.js";

const roles = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.role]));

test("ROLES lists the nine roles", () => {
  assert.equal(ROLES.length, 9);
  assert.ok(ROLES.includes("sentenceAudio"));
});

test("lapis names only", () => {
  const names = ["Expression", "ExpressionFurigana", "ExpressionReading", "ExpressionAudio", "MainDefinition", "Sentence", "SentenceFurigana", "SentenceAudio", "Picture", "MiscInfo"];
  const r = guessFieldRoles(names, []);
  assert.deepEqual(roles(r), {
    Expression: "expression",
    ExpressionFurigana: null,
    ExpressionReading: "reading",
    ExpressionAudio: null,
    MainDefinition: "meaning",
    Sentence: "sentence",
    SentenceFurigana: "sentenceFurigana",
    SentenceAudio: "sentenceAudio",
    Picture: "picture",
    MiscInfo: "source",
  });
  for (const f of names) if (r[f].role) assert.equal(r[f].from, "name");
});

test("basic with samples", () => {
  const r = guessFieldRoles(["Front", "Back"], [
    { Front: "食べる", Back: "to eat" },
    { Front: "雨", Back: "rain" },
  ]);
  assert.equal(r.Front.role, "expression");
  assert.equal(r.Back.role, "meaning");
  assert.equal(r.Back.format, "plain");
  assert.equal(r.Front.sample, "食べる");
});

test("content beats name", () => {
  const r = guessFieldRoles(["Front", "Back"], [
    { Front: "食べる", Back: "私は毎日りんごを食べる。" },
    { Front: "雨", Back: "今日は雨が降っています。" },
  ]);
  assert.equal(r.Back.role, "sentence");
  assert.equal(r.Back.from, "content");
});

test("japanese names", () => {
  const r = guessFieldRoles(["単語", "読み", "意味", "例文", "画像", "音声"], []);
  assert.deepEqual(roles(r), { 単語: "expression", 読み: "reading", 意味: "meaning", 例文: "sentence", 画像: "picture", 音声: "sentenceAudio" });
});

test("one field per role", () => {
  const r = guessFieldRoles(["Word", "Vocab"], []);
  assert.equal(r.Word.role, "expression");
  assert.equal(r.Vocab.role, null);
});

test("formats", () => {
  const a = guessFieldRoles(["Reading"], [{ Reading: "食[た]べる" }, { Reading: "飲[の]む" }]);
  assert.equal(a.Reading.role, "reading");
  assert.equal(a.Reading.format, "bracket");
  const b = guessFieldRoles(["Meaning"], [{ Meaning: "<ol><li>to eat</li></ol>" }]);
  assert.equal(b.Meaning.role, "meaning");
  assert.equal(b.Meaning.format, "list");
});

test("fieldListChanged", () => {
  assert.equal(fieldListChanged(["A", "B"], ["A", "B"]), false);
  assert.equal(fieldListChanged(["A", "B"], ["A", "C"]), true);
  assert.equal(fieldListChanged(["A", "B"], ["B", "A"]), true);
});

const farmingNames = ["Front", "Back", "Audio", "English defintion", "Screenshot"];
const farmingSamples = [
  { Front: "美しい<b>眺</b><b>め</b>だった。", Back: "眺め (ながめ)<br><br>英語：scene; view; prospect; outlook" },
  { Front: "<b>雨</b>が降っている。", Back: "雨 (あめ)<br><br>英語：rain" },
  { Front: "毎日<b>食</b><b>べ</b><b>る</b>。", Back: "食べる (たべる)<br><br>英語：to eat" },
].map((s) => ({ ...s, Audio: "", "English defintion": "", Screenshot: "" }));

test("sentence farming", () => {
  const r = guessFieldRoles(farmingNames, farmingSamples);
  assert.equal(r.Front.role, "sentence");
  assert.equal(r.Front.from, "content");
  assert.equal(r.Back.role, "template");
  assert.equal(r.Back.template, "{expression} ({reading})<br><br>英語：{meaning}");
  assert.equal(r.Audio.role, "sentenceAudio");
  assert.equal(r.Audio.from, "name");
  assert.equal(r.Screenshot.role, "picture");
  assert.equal(r["English defintion"].role, null);
});

test("no bold no template", () => {
  const r = guessFieldRoles(["Front", "Back"], [
    { Front: "美しい眺めだった。", Back: "眺め (ながめ)<br><br>英語：scene" },
    { Front: "雨が降っている。", Back: "雨 (あめ)<br><br>英語：rain" },
  ]);
  assert.ok(!Object.values(r).some((v) => v.role === "template"));
});

test("short sentence ending in 。 is a sentence, not an expression", () => {
  const r = guessFieldRoles(["Front", "Back"], [
    { Front: "美しい<b>眺</b><b>め</b>だった。", Back: "x" },
    { Front: "<b>雨</b>が降る。", Back: "y" },
  ]);
  assert.equal(r.Front.role, "sentence");
});

test("template pairs words by sample index when a field is empty in one sample", () => {
  const r = guessFieldRoles(["Front", "Back"], [
    { Front: "美しい<b>眺</b><b>め</b>だった。", Back: "" },
    { Front: "<b>雨</b>が降っている。", Back: "雨 (あめ)<br><br>英語：rain" },
    { Front: "毎日<b>食</b><b>べ</b><b>る</b>。", Back: "食べる (たべる)<br><br>英語：to eat" },
  ]);
  assert.equal(r.Back.role, "template");
  assert.equal(r.Back.template, "{expression} ({reading})<br><br>英語：{meaning}");
});

test("content-matched ExpressionAudio never becomes sentenceAudio", () => {
  const r = guessFieldRoles(["Expression", "ExpressionAudio"], [
    { Expression: "食べる", ExpressionAudio: "[sound:a.mp3]" },
    { Expression: "雨", ExpressionAudio: "[sound:b.mp3]" },
  ]);
  assert.equal(r.ExpressionAudio.role, null);
});

test("real shape: template with sound and picture slots", () => {
  const zw = "\u200b";
  const names = ["Front", "Back", "Audio", "English defintion", "Screenshot"];
  const blank = { Audio: "", "English defintion": "", Screenshot: "" };
  const r = guessFieldRoles(names, [
    { ...blank, Front: "あした<b>国語</b>だっけ", Back: `国語 （こくご）＝Japanese language (esp. as a school subject in Japan)${zw}<br><br>[sound:mpv_a.mp3]<br><br><img src="paste-a.jpg">` },
    { ...blank, Front: "<b>神楽殿</b>の掃除だよ", Back: `神楽殿（かぐらでん）＝kagura hall (at a shrine); sacred dance stage<br><br>[sound:mpv_b.mp3]<br><br><img src="paste-b.jpg">` },
    { ...blank, Front: "あっちは２<b>作目</b><br>今回は１作目のほう", Back: `作目（つくりめ）＝To look different from usual<br><br>[sound:mpv_c.mp3]<br><br><img src="paste-c.jpg">` },
  ]);
  assert.equal(r.Front.role, "sentence");
  assert.equal(r.Back.role, "template");
  assert.equal(r.Back.template, "{expression}（{reading}）＝{meaning}<br><br>{sentenceAudio}<br><br>{picture}");
  assert.equal(r.Screenshot.role, null);
  assert.equal(r.Audio.role, null);
  assert.equal(r["English defintion"].role, null);
});
