import test from "node:test";
import assert from "node:assert/strict";
import { upsertRecent, cleanRecents, loadRecents, saveRecents, formatClock, stoppedLabel, resumeAt, RECENTS_KEY } from "./recents.js";

const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test("upsert merges by key, sorts newest first and trims", () => {
  let list = [];
  list = upsertRecent(list, { key: "a", name: "A", positionS: 10 }, 100);
  list = upsertRecent(list, { key: "b", name: "B" }, 200);
  list = upsertRecent(list, { key: "a", coverage: 70 }, 300);
  assert.deepEqual(list.map((r) => r.key), ["a", "b"]);
  assert.equal(list[0].positionS, 10);
  assert.equal(list[0].coverage, 70);
  assert.equal(list[0].watchedAt, 300);
  for (let i = 0; i < 20; i++) list = upsertRecent(list, { key: `k${i}`, name: "x" }, 1000 + i, 12);
  assert.equal(list.length, 12);
  assert.equal(list[0].key, "k19");
});

test("clean drops bad entries and coerces numbers", () => {
  const out = cleanRecents([{ key: "a", name: "A", coverage: "x", watchedAt: 5 }, null, { name: "no key" }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].coverage, null);
  assert.deepEqual(cleanRecents("nope"), []);
});

test("load and save round-trip, and survive broken storage", () => {
  const s = mem();
  saveRecents([{ key: "a", name: "A", watchedAt: 1 }], s);
  assert.equal(loadRecents(s)[0].key, "a");
  s.setItem(RECENTS_KEY, "{bad");
  assert.deepEqual(loadRecents(s), []);
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.deepEqual(loadRecents(broken), []);
  assert.doesNotThrow(() => saveRecents([], broken));
});

test("clock and stopped label", () => {
  assert.equal(formatClock(252), "4:12");
  assert.equal(formatClock(3725), "1:02:05");
  assert.equal(stoppedLabel({ positionS: 252, durationS: 1420 }), "Stopped at 4:12 of 23:40");
  assert.equal(stoppedLabel({ positionS: 252 }), "Stopped at 4:12");
  assert.equal(stoppedLabel({ positionS: 0, durationS: 100 }), "");
});

test("resume only for the same file", () => {
  const row = { key: "a|1|2", positionS: 90 };
  assert.equal(resumeAt(row, "a|1|2"), 90);
  assert.equal(resumeAt(row, "b|1|2"), null);
  assert.equal(resumeAt({ key: "a", positionS: 1 }, "a"), null);
});
