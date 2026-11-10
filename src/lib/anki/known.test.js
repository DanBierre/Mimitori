import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanExpression, wordFromNote, fetchDeckWords } from "./known.js";

const DAN = {
  Front: { role: "sentence" },
  Back: { role: "template", template: "{expression}（{reading}）＝{meaning}<br><br>{sentenceAudio}<br><br>{picture}" },
};

test("cleanExpression strips html, sound, brackets, spaces, nbsp", () => {
  assert.equal(cleanExpression("<b>食[た]べる</b>"), "食べる");
  assert.equal(cleanExpression("雨 [sound:a.mp3]"), "雨");
  assert.equal(cleanExpression("&nbsp;日本 語"), "日本語");
});

test("wordFromNote: expression field", () => {
  assert.equal(wordFromNote({ Expression: "<b>食[た]べる</b>" }, { Expression: { role: "expression" } }), "食べる");
});

test("wordFromNote: template wins over bold sentence", () => {
  const fields = { Front: "あした<b>国語</b>だっけ", Back: "国語 （こくご）＝Japanese language<br><br>[sound:a.mp3]" };
  assert.equal(wordFromNote(fields, DAN), "国語");
});

test("wordFromNote: bold spans joined", () => {
  const m = { Front: { role: "sentence" }, Back: { role: "meaning" } };
  assert.equal(wordFromNote({ Front: "<b>神楽</b><b>殿</b>の掃除", Back: "x" }, m), "神楽殿");
});

test("wordFromNote: nothing usable", () => {
  assert.equal(wordFromNote({ Front: "plain", Back: "x" }, { Front: { role: "sentence" }, Back: { role: "meaning" } }), "");
});

test("fetchDeckWords splits known and inDeck", async () => {
  const calls = [];
  const info = (id, front, back) => ({
    noteId: id,
    modelName: "M",
    fields: { Front: { value: front, order: 0 }, Back: { value: back, order: 1 } },
  });
  const anki = {
    async invoke(action, params) {
      calls.push([action, params]);
      if (action === "findNotes") {
        return params.query.includes("prop:ivl>=21") ? [1] : [1, 2, 3];
      }
      if (action === "notesInfo") {
        return params.notes.map((id) =>
          id === 1 ? info(1, "x<b>食べる</b>", "食べる （たべる）＝eat")
            : id === 2 ? info(2, "x<b>雨</b>", "雨 （あめ）＝rain")
              : info(3, "none", "none"));
      }
    },
  };
  const out = await fetchDeckWords(anki, { deck: "日本語一般で", model: "M", mapping: DAN });
  assert.deepEqual(out, { known: { 食べる: true }, inDeck: { 雨: true } });
  const queries = calls.filter((c) => c[0] === "findNotes").map((c) => c[1].query);
  assert.deepEqual(queries, [
    '"deck:日本語一般で"',
    '"deck:日本語一般で" prop:ivl>=21',
  ]);
});

test("wordFromNote: real Back variants", () => {
  const tail = "<br><br>[sound:x.mp3]<br><br><img src=\"y.jpg\">";
  const m = { Front: { role: "sentence" }, Back: DAN.Back };
  const cases = [
    ["国語", "あした<b>国語</b>だっけ", `国語 （こくご）＝Japanese language${tail}`],
    ["種", "これは<b>種</b>だ", `種（たね）＝seed (e.g. of a plant); pip${tail}`],
    ["信頼感", "<b>信頼感</b>がある", `信頼感 (しんらいかん) = trust${tail}`],
    ["阻止", "<b>阻止</b>する", "阻止 （とし）＝　obstruction; prevention"],
    ["ケガのせい", "<b>ケガ</b>のせい", `ケガのせい=Because of an injury${tail}`],
    ["範囲", "<b>範囲</b>外", "範囲外はんいがい）=out of range"],
  ];
  for (const [want, Front, Back] of cases) assert.equal(wordFromNote({ Front, Back }, m), want);
});

test("fetchDeckWords reads all models, guessing unmapped ones", async () => {
  const f = (v, o) => ({ value: v, order: o });
  const notes = [
    { noteId: 1, modelName: "Farm", fields: { Front: f("x<b>国語</b>y", 0), Back: f("国語 （こくご）＝language", 1) } },
    ...[["雨", "あめ", "rain"], ["犬", "いぬ", "dog"], ["猫", "ねこ", "cat"]].map(([w, r, e], i) => ({
      noteId: 10 + i,
      modelName: "Basic",
      fields: { Front: f(`それは<b>${w}</b>だ`, 0), Back: f(`${w}（${r}）＝${e}<br><br>[sound:a.mp3]<br><br><img src="a.jpg">`, 1) },
    })),
  ];
  const anki = {
    async invoke(action, params) {
      if (action === "findNotes") return params.query.includes("ivl") ? [] : notes.map((n) => n.noteId);
      return notes.filter((n) => params.notes.includes(n.noteId));
    },
  };
  const out = await fetchDeckWords(anki, { deck: "D", model: "Farm", mapping: DAN });
  assert.deepEqual(Object.keys(out.inDeck).sort(), ["国語", "犬", "猫", "雨"].sort());
});
