import test from "node:test";
import assert from "node:assert/strict";
import { commonForms } from "./build-common.mjs";

test("commonForms keeps nf01-nf04 and drops nf05 and untagged", () => {
  const xml = `<JMdict>
<entry><k_ele><keb>何</keb><ke_pri>nf02</ke_pri></k_ele><r_ele><reb>なに</reb></r_ele></entry>
<entry><k_ele><keb>猫</keb><ke_pri>nf05</ke_pri></k_ele><r_ele><reb>ねこ</reb></r_ele></entry>
<entry><k_ele><keb>犬</keb></k_ele><r_ele><reb>いぬ</reb><re_pri>ichi1</re_pri></r_ele></entry>
</JMdict>`;
  assert.deepEqual(commonForms(xml), ["なに", "何"]);
});

test("commonForms lists kana when only the reading is tagged", () => {
  const xml = `<entry><r_ele><reb>する</reb><re_pri>nf01</re_pri></r_ele></entry>`;
  assert.deepEqual(commonForms(xml), ["する"]);
});
