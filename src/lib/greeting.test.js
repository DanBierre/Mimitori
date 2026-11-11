import { test } from "node:test";
import assert from "node:assert/strict";
import { addedThisWeek, greeting } from "./greeting.js";

const at = (h) => new Date(2026, 10, 11, h, 0);

test("greeting follows the local hour", () => {
  assert.equal(greeting(at(4)), "こんばんは");
  assert.equal(greeting(at(5)), "おはよう");
  assert.equal(greeting(at(11)), "こんにちは");
  assert.equal(greeting(at(17)), "こんばんは");
});

test("greeting adds the name only when set", () => {
  assert.equal(greeting(at(9), "Dan"), "おはよう、Dan");
  assert.equal(greeting(at(9), "  "), "おはよう");
});

test("addedThisWeek counts recent saves and dated known words only", () => {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  const state = {
    words: { a: { addedAt: now - day }, b: { addedAt: now - 9 * day } },
    known: { c: now - 2 * day, d: true, e: now - 8 * day },
  };
  assert.equal(addedThisWeek(state, now), 2);
});
