import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeSubtitleBytes } from "./decode.js";

test("utf8", () => {
  assert.equal(decodeSubtitleBytes(new TextEncoder().encode("日本")), "日本");
});

test("utf8 bom", () => {
  const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("日本")]);
  assert.equal(decodeSubtitleBytes(bytes), "日本");
});

test("utf16le bom", () => {
  assert.equal(decodeSubtitleBytes(new Uint8Array([0xff, 0xfe, 0xe5, 0x65, 0x2c, 0x67])), "日本");
});

test("shift_jis fallback", () => {
  assert.equal(decodeSubtitleBytes(new Uint8Array([0x93, 0xfa, 0x96, 0x7b])), "日本");
});

test("accepts ArrayBuffer", () => {
  assert.equal(decodeSubtitleBytes(new TextEncoder().encode("やあ").buffer), "やあ");
});
