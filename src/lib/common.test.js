import test from "node:test";
import assert from "node:assert/strict";
import { loadCommon, isVeryCommon, resetCommon } from "./common.js";

test("loadCommon: a failed fetch leaves isVeryCommon false", async () => {
  resetCommon();
  await loadCommon(async () => { throw new Error("offline"); });
  assert.equal(isVeryCommon("何"), false);
});

test("loadCommon: a good fetch makes listed words very common", async () => {
  resetCommon();
  await loadCommon(async () => ({ ok: true, headers: new Map(), json: async () => ["何"] }));
  assert.equal(isVeryCommon("何"), true);
  assert.equal(isVeryCommon("猫"), false);
});

test("loadCommon: retries after a failed fetch", async () => {
  resetCommon();
  await loadCommon(async () => { throw new Error("offline"); });
  assert.equal(isVeryCommon("の"), false);
  await loadCommon(async () => ({ ok: true, headers: new Headers(), json: async () => ["の"] }));
  assert.equal(isVeryCommon("の"), true);
});
