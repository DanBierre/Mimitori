import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNote } from "./buildNote.js";

const lapis = {
  Expression: { role: "expression" },
  ExpressionReading: { role: "reading", format: "kana" },
  MainDefinition: { role: "meaning", format: "plain" },
  Sentence: { role: "sentence" },
  SentenceFurigana: { role: "sentenceFurigana" },
  SentenceTranslation: { role: "sentenceTranslation" },
  Picture: { role: "picture" },
  SentenceAudio: { role: "sentenceAudio" },
  MiscInfo: { role: "source" },
};
const word = { base: "食べる", surface: "食べ", reading: "たべる", glosses: ["to eat"] };
const tokens = [
  { surface: "食べ", segments: [{ text: "食", ruby: "た" }, { text: "べ" }] },
  { surface: "なかった。…", segments: [{ text: "なかった。…" }] },
];
const context = { sentence: "食べなかった。…", tokens, tokenIndex: 0, translation: "I didn't eat.", fileName: "ep01.mp4", timeMs: 9200, now: 5 };
const media = { picture: { data: "AAA", ext: "jpg" }, audio: { data: "BBB", ext: "webm" } };

test("fills mapped roles", () => {
  const n = buildNote({ deck: "D", model: "M", mapping: lapis, word, context, media });
  assert.equal(n.deckName, "D");
  assert.equal(n.modelName, "M");
  assert.deepEqual(n.tags, ["mimitori"]);
  assert.deepEqual(n.options, { allowDuplicate: false, duplicateScope: "deck" });
  assert.equal(n.fields.Expression, "食べる");
  assert.equal(n.fields.ExpressionReading, "たべる");
  assert.equal(n.fields.MainDefinition, "to eat");
  assert.equal(n.fields.Sentence, "<b>食べ</b>なかった。…");
  assert.equal(n.fields.SentenceFurigana, "<b>食[た]べ</b>なかった。…");
  assert.equal(n.fields.SentenceTranslation, "I didn't eat.");
  assert.equal(n.fields.MiscInfo, "ep01.mp4 · 0:09");
  assert.deepEqual(n.picture[0].fields, ["Picture"]);
  assert.deepEqual(n.audio[0].fields, ["SentenceAudio"]);
  assert.equal(n.picture[0].filename, "mimitori-食べる-5.jpg");
  assert.equal(n.audio[0].filename, "mimitori-食べる-5.webm");
  assert.equal(n.picture[0].data, "AAA");
  assert.deepEqual(n.storeMedia, []);
});

test("bracket reading", () => {
  const mapping = { R: { role: "reading", format: "bracket" } };
  assert.equal(buildNote({ deck: "D", model: "M", mapping, word, context: {} }).fields.R, "食[た]べる");
});

test("read tab save", () => {
  const n = buildNote({ deck: "D", model: "M", mapping: lapis, word, context: { sentence: "食べなかった。", now: 5 } });
  assert.equal("picture" in n, false);
  assert.equal("audio" in n, false);
  for (const f of ["Picture", "SentenceAudio", "SentenceTranslation", "MiscInfo"]) assert.equal(n.fields[f], "");
});

test("unmapped fields empty", () => {
  const n = buildNote({ deck: "D", model: "M", mapping: { X: { role: null } }, word, context: {} });
  assert.equal(n.fields.X, "");
});

const dan = {
  Front: { role: "sentence" },
  Back: { role: "template", format: "plain", template: "{expression}（{reading}）＝{meaning}<br><br>{sentenceAudio}<br><br>{picture}" },
  Audio: { role: null },
  "English defintion": { role: null },
  Screenshot: { role: null },
};
const kokugo = { base: "国語", surface: "国語", reading: "こくご", glosses: ["Japanese language"] };

test("dan's template", () => {
  const n = buildNote({ deck: "D", model: "M", mapping: dan, word: kokugo, context: { sentence: "あした国語だっけ", now: 1000 }, media });
  assert.equal(n.fields.Front, "あした<b>国語</b>だっけ");
  assert.equal(n.fields.Back, '国語（こくご）＝Japanese language<br><br>[sound:mimitori-国語-1000.webm]<br><br><img src="mimitori-国語-1000.jpg">');
  assert.deepEqual(n.storeMedia, [
    { filename: "mimitori-国語-1000.webm", data: "BBB" },
    { filename: "mimitori-国語-1000.jpg", data: "AAA" },
  ]);
  assert.equal("picture" in n, false);
  assert.equal("audio" in n, false);
  for (const f of ["Audio", "English defintion", "Screenshot"]) assert.equal(n.fields[f], "");
});

test("template without media", () => {
  const n = buildNote({ deck: "D", model: "M", mapping: dan, word: kokugo, context: { sentence: "あした国語だっけ", now: 1000 } });
  assert.equal(n.fields.Back, "国語（こくご）＝Japanese language");
  assert.deepEqual(n.storeMedia, []);
});

test("buildNote collapses runs of <br> and bolds the tapped occurrence", async () => {
  const { buildNote } = await import("./buildNote.js");
  const word = { base: "食べる", surface: "食べ", reading: "たべる", glosses: ["eat"] };
  const n = buildNote({
    deck: "d", model: "m", word,
    mapping: { A: { role: "template", template: "{expression}<br><br><br>{picture}<br><br>{meaning}" }, S: { role: "sentence" } },
    context: { sentence: "食べて食べた", tokens: [{ surface: "食べ" }, { surface: "て" }, { surface: "食べ" }, { surface: "た" }], tokenIndex: 2 },
  });
  assert.equal(n.fields.A, "食べる<br><br>eat");
  assert.equal(n.fields.S, "食べて<b>食べ</b>た");
});
