import { test } from "node:test";
import assert from "node:assert/strict";
import { lookupKeys, pickEntry } from "./dict.js";

const 降る = [{ r: "くだる" }, { r: "ふる" }];

test("pickEntry follows the reading in the text", () => {
  assert.equal(pickEntry(降る, "ふる"), 1);
  assert.equal(pickEntry(降る, "フッタ"), 1); // katakana, conjugated: 降った
  assert.equal(pickEntry(降る, "くだっ"), 0);
});

test("pickEntry keeps JMdict's first entry when the reading doesn't help", () => {
  assert.equal(pickEntry(降る, ""), 0);
  assert.equal(pickEntry(降る, undefined), 0);
  assert.equal(pickEntry([{ r: "いく" }, { r: "ゆく" }], "おこなう"), 0);
});

test("lookupKeys falls back from a polite お/ご form to the plain word", () => {
  assert.deepEqual(lookupKeys({ base: "お世話", surface: "お世話", reading: "オセワ" }), ["お世話", "お世話", "オセワ", "世話"]);
  assert.deepEqual(lookupKeys({ base: "ご馳走", surface: "ご馳走" }), ["ご馳走", "ご馳走", "馳走"]);
  // Only before kanji: おいしい and ごろ stay as they are.
  assert.deepEqual(lookupKeys({ base: "おいしい", surface: "おいしい" }), ["おいしい", "おいしい"]);
});

test("loadDict retries after a failed load", async () => {
  const { loadDict } = await import("./dict.js");
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) throw new Error("offline");
    return { ok: true, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ ok: 1 }) };
  };
  try {
    assert.equal(await loadDict(), null);
    assert.deepEqual(await loadDict(), { ok: 1 });
  } finally {
    globalThis.fetch = real;
  }
});
