import test from "node:test";
import assert from "node:assert/strict";
import { planBatch, sendBatch } from "./batch.js";

const w = (base) => ({ base });
const state = (extra = {}) => ({
  known: { 犬: true },
  anki: { known: {}, inDeck: { 鳥: true } },
  settings: { commonKnown: true },
  ...extra,
});
const common = new Set(["何"]);

test("planBatch skips known, in-Anki and very common words", () => {
  const { send, skip } = planBatch([w("犬"), w("鳥"), w("何"), w("猫")], state(), common);
  assert.deepEqual(send.map((x) => x.base), ["猫"]);
  assert.equal(skip.length, 3);
});

test("planBatch keeps very common words when commonKnown is off", () => {
  const { send } = planBatch([w("何")], state({ settings: { commonKnown: false } }), common);
  assert.deepEqual(send.map((x) => x.base), ["何"]);
});

test("sendBatch counts queued as queued and never sends a base twice", async () => {
  const sent = [];
  const r = await sendBatch({ words: [w("猫"), w("猫")], send: async (x) => (sent.push(x.base), "queued") });
  assert.deepEqual(sent, ["猫"]);
  assert.equal(r.queued, 1);
  assert.equal(r.skipped, 1);
});

test("sendBatch stops on changed", async () => {
  const sent = [];
  const results = ["added", "changed", "added"];
  const r = await sendBatch({
    words: [w("a"), w("b"), w("c")],
    send: async (x) => (sent.push(x.base), results[sent.length - 1]),
  });
  assert.ok(r.stopped);
  assert.deepEqual(sent, ["a", "b"]);
  assert.equal(r.added, 1);
});
