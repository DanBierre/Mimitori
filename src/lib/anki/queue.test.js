import { test } from "node:test";
import assert from "node:assert/strict";
import { recordFailure, shouldGiveUp } from "./queue.js";

const item = { id: "a", note: {}, failures: 0, lastError: "", queuedAt: 1 };

test("unreachable leaves failures unchanged", () => {
  const out = recordFailure(item, "unreachable", "Failed to fetch");
  assert.equal(out.failures, 0);
  assert.equal(out.lastError, "");
});

test("anki error adds a failure and records the message", () => {
  const out = recordFailure(item, "anki", "model not found");
  assert.equal(out.failures, 1);
  assert.equal(out.lastError, "model not found");
  assert.equal(item.failures, 0);
});

test("shouldGiveUp is false at 4, true at 5", () => {
  assert.equal(shouldGiveUp({ failures: 4 }), false);
  assert.equal(shouldGiveUp({ failures: 5 }), true);
});
