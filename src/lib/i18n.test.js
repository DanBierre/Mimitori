import { test } from "node:test";
import assert from "node:assert/strict";
import { translate } from "./i18n.js";

test("English passes through and fills slots", () => {
  assert.equal(translate("en", "Settings"), "Settings");
  assert.equal(translate("en", "{n} new words", { n: 7 }), "7 new words");
});

test("Japanese uses the dictionary and falls back to English", () => {
  assert.equal(translate("ja", "Settings"), "設定");
  assert.equal(translate("ja", "No such string yet"), "No such string yet");
});

test("review intervals read naturally in Japanese", () => {
  assert.equal(translate("ja", "3d"), "3日");
  assert.equal(translate("ja", "2mo"), "2か月");
  assert.equal(translate("en", "3d"), "3d");
});
