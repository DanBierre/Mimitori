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
