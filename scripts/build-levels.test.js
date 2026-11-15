import test from "node:test";
import assert from "node:assert/strict";
import { buildLevels, jlptBySeq } from "./build-levels.mjs";

test("jlptBySeq keeps the easiest level when a word is on two lists", () => {
  const m = jlptBySeq({ 1: "jmdict_seq,kana,kanji,def\n100,あ,亜,x\n", 5: "jmdict_seq,kana\r\n100,あ\r\n200,い\r\n" });
  assert.equal(m.get("100"), 5);
  assert.equal(m.get("200"), 5);
  assert.equal(m.size, 2);
});

test("buildLevels tags forms by level and common marks per spelling", () => {
  const xml = `
<entry><ent_seq>1</ent_seq><k_ele><keb>紙</keb><ke_pri>ichi1</ke_pri></k_ele><r_ele><reb>かみ</reb><re_pri>ichi1</re_pri></r_ele></entry>
<entry><ent_seq>2</ent_seq><k_ele><keb>神</keb><ke_pri>news1</ke_pri></k_ele><r_ele><reb>かみ</reb></r_ele></entry>
<entry><ent_seq>3</ent_seq><k_ele><keb>猫</keb><ke_pri>nf20</ke_pri></k_ele><k_ele><keb>貓</keb></k_ele><r_ele><reb>ねこ</reb></r_ele></entry>
<entry><ent_seq>4</ent_seq><k_ele><keb>無</keb></k_ele></entry>`;
  const out = buildLevels(xml, new Map([["1", 4], ["2", 1], ["3", 5]]));
  assert.deepEqual(out.jlpt, { 1: ["神"], 4: ["かみ", "紙"], 5: ["ねこ", "猫", "貓"] });
  assert.deepEqual(out.common, ["かみ", "神", "紙"]);
});
