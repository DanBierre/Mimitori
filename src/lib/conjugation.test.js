import { test } from "node:test";
import assert from "node:assert/strict";
import { conjugationParts } from "./conjugation.js";

// Token arrays shaped like kuromoji IPADIC output (only the fields we read).
const t = (surface, base, pos, posDetail = "*") => ({ surface, base, pos, posDetail });

test("食べなかった", () => {
  const tokens = [t("食べ", "食べる", "動詞", "自立"), t("なかっ", "ない", "助動詞"), t("た", "た", "助動詞")];
  assert.deepEqual(conjugationParts(tokens, 0), ["not", "past"]);
});

test("行きます", () => {
  assert.deepEqual(conjugationParts([t("行き", "行く", "動詞", "自立"), t("ます", "ます", "助動詞")], 0), ["polite"]);
});

test("見られた", () => {
  // Real IPADIC output: られ is a verb suffix (動詞/接尾), not 助動詞.
  const tokens = [t("見", "見る", "動詞", "自立"), t("られ", "られる", "動詞", "接尾"), t("た", "た", "助動詞")];
  assert.deepEqual(conjugationParts(tokens, 0), ["passive / can", "past"]);
});

test("読んでいる", () => {
  const tokens = [t("読ん", "読む", "動詞", "自立"), t("で", "で", "助詞", "接続助詞"), t("いる", "いる", "動詞", "非自立")];
  assert.deepEqual(conjugationParts(tokens, 0), ["-te form", "-ing / state"]);
});

test("高かった", () => {
  assert.deepEqual(conjugationParts([t("高かっ", "高い", "形容詞", "自立"), t("た", "た", "助動詞")], 0), ["past"]);
});

test("noun", () => {
  assert.deepEqual(conjugationParts([t("本", "本", "名詞", "一般")], 0), []);
});

test("stops at next word", () => {
  const tokens = [t("食べ", "食べる", "動詞", "自立"), t("た", "た", "助動詞"), t("本", "本", "名詞", "一般"), t("だ", "だ", "助動詞")];
  assert.deepEqual(conjugationParts(tokens, 0), ["past"]);
});

test("repeats collapse", () => {
  const tokens = [t("食べ", "食べる", "動詞", "自立"), t("ませ", "ます", "助動詞"), t("ん", "ん", "助動詞"), t("でし", "です", "助動詞"), t("た", "た", "助動詞")];
  assert.deepEqual(conjugationParts(tokens, 0), ["polite", "not", "polite", "past"]);
});

test("conditionals, while, even if and looks like", () => {
  const v = (surface, base) => t(surface, base, "動詞", "自立");
  assert.deepEqual(conjugationParts([v("食べれ", "食べる"), t("ば", "ば", "助詞", "接続助詞")], 0), ["if"]);
  assert.deepEqual(conjugationParts([v("食べ", "食べる"), t("たら", "た", "助動詞")], 0), ["if / when"]);
  assert.deepEqual(conjugationParts([v("読ん", "読む"), t("だら", "だ", "助動詞")], 0), ["if / when"]);
  assert.deepEqual(conjugationParts([v("食べ", "食べる"), t("ながら", "ながら", "助詞", "接続助詞")], 0), ["while"]);
  assert.deepEqual(conjugationParts([v("食べ", "食べる"), t("て", "て", "助詞", "接続助詞"), t("も", "も", "助詞", "係助詞"), t("いい", "いい", "形容詞", "自立")], 0), ["even if"]);
  assert.deepEqual(conjugationParts([t("寒", "寒い", "形容詞", "自立"), t("そう", "そう", "名詞", "接尾")], 0), ["looks like"]);
  assert.deepEqual(conjugationParts([v("行か", "行く"), t("なけれ", "ない", "助動詞"), t("ば", "ば", "助詞", "接続助詞")], 0), ["not", "if"]);
});

test("helper verbs after the te form", () => {
  const v = (surface, base) => t(surface, base, "動詞", "自立");
  const te = t("て", "て", "助詞", "接続助詞");
  assert.deepEqual(conjugationParts([v("食べ", "食べる"), te, t("みる", "みる", "動詞", "非自立")], 0), ["-te form", "try"]);
  assert.deepEqual(conjugationParts([v("食べ", "食べる"), t("ちゃっ", "ちゃう", "動詞", "非自立"), t("た", "た", "助動詞")], 0), ["completely / oops", "past"]);
  assert.deepEqual(conjugationParts([v("食べ", "食べる"), t("てる", "てる", "動詞", "非自立")], 0), ["-ing / state"]);
  // A も that isn't after て is the next word, not an ending.
  assert.deepEqual(conjugationParts([v("食べる", "食べる"), t("も", "も", "助詞", "係助詞")], 0), []);
});
