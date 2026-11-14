import test from "node:test";
import assert from "node:assert/strict";
import { SAMPLES } from "./samples.js";

test("samples: enough, unique, non-empty strings, not too long", () => {
  assert.ok(SAMPLES.length >= 50);
  assert.equal(new Set(SAMPLES).size, SAMPLES.length);
  for (const s of SAMPLES) {
    assert.equal(typeof s, "string");
    assert.ok(s.trim().length > 0);
    assert.ok(s.length <= 400, `too long (${s.length}): ${s.slice(0, 20)}`);
  }
});
