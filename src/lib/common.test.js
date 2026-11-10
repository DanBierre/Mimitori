import test from "node:test";
import assert from "node:assert/strict";
import { loadCommon, isVeryCommon } from "./common.js";

test("loadCommon: a failed fetch leaves isVeryCommon false", async () => {
  await loadCommon(async () => { throw new Error("offline"); });
  assert.equal(isVeryCommon("何"), false);
});
