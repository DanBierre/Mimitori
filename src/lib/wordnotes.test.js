import { test } from "node:test";
import assert from "node:assert/strict";
import { accentFor, kanjiParts, loadTable, moras, pitchMarks } from "./wordnotes.js";
import { buildKanji, buildPitch } from "../../scripts/build-wordnotes.mjs";

const hi = (reading, accent) => pitchMarks(reading, accent).map((m) => (m.high ? "H" : "L") + (m.drop ? "↓" : "")).join("");

test("moras joins small kana to the mora before", () => {
  assert.deepEqual(moras("きょう"), ["きょ", "う"]);
  assert.deepEqual(moras("シャツ"), ["シャ", "ツ"]);
  assert.deepEqual(moras(""), []);
});

test("pitchMarks follows Tokyo accent patterns", () => {
  assert.equal(hi("さくら", 0), "LHH"); // heiban
  assert.equal(hi("ねこ", 1), "H↓L"); // atamadaka
  assert.equal(hi("たべる", 2), "LH↓L"); // nakadaka
  assert.equal(hi("はし", 2), "LH↓"); // odaka: the drop falls on the next particle
});

test("accentFor picks the reading that matches, in hiragana or katakana", () => {
  assert.equal(accentFor("きょう:1|はし:2", "はし"), 2);
  assert.equal(accentFor("ねこ:1,0", "ネコ"), 1);
  assert.equal(accentFor("ねこ:1", "いぬ"), -1);
  assert.equal(accentFor(undefined, "ねこ"), -1);
});

test("kanjiParts lists each kanji once, skipping kana", () => {
  const table = { 食: ["eat", "ショク", "た(べる)"], 物: ["thing", "ブツ", "もの"] };
  assert.deepEqual(
    kanjiParts("食べ物食", table).map((p) => p.kanji),
    ["食", "物"],
  );
});

test("loadTable falls back to an empty table and retries after a failure", async () => {
  let calls = 0;
  const fail = () => (calls++, Promise.reject(new Error("offline")));
  assert.deepEqual(await loadTable("nope", fail), {});
  await loadTable("nope", fail);
  assert.equal(calls, 2);
});

test("build scripts keep only wanted pitch words and graded kanji", () => {
  const pitch = buildPitch("猫\tねこ\t1\n猫\tねこま\t0\n鬱\tうつ\t1\nbad line\n", (f) => f !== "鬱");
  assert.deepEqual(pitch, { 猫: "ねこ:1|ねこま:0" });
  const xml = `<character><literal>食</literal><misc><grade>2</grade></misc><reading r_type="ja_on">ショク</reading><reading r_type="ja_kun">た.べる</reading><meaning>eat</meaning><meaning m_lang="fr">manger</meaning></character>
<character><literal>龘</literal><misc></misc><meaning>dragon</meaning></character>`;
  assert.deepEqual(buildKanji(xml), { 食: ["eat", "ショク", "た(べる)"] });
});
