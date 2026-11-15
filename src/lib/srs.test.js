import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyQueue, isDue, newCard, repairWords, reviewNote } from "./srs.js";

const now = new Date(2026, 10, 11, 12, 0);
const word = (i, dueOffsetH, lastReviewH) => ({
  base: `w${i}`,
  card: {
    due: new Date(now.getTime() + dueOffsetH * 3600e3),
    last_review: lastReviewH === undefined ? undefined : new Date(now.getTime() - lastReviewH * 3600e3),
  },
});
const many = (n) => Array.from({ length: n }, (_, i) => word(i, -48 - i));

test("under the cap everything shows", () => {
  const r = dailyQueue(many(7), now);
  assert.equal(r.queue.length, 7);
  assert.equal(r.waiting, 0);
});

test("over the cap shows 20 and the rest wait, oldest first", () => {
  const r = dailyQueue(many(32), now);
  assert.equal(r.queue.length, 20);
  assert.equal(r.waiting, 12);
  assert.equal(r.queue[0].base, "w31");
});

test("cards already reviewed today count toward the 20", () => {
  const done = Array.from({ length: 15 }, (_, i) => word(100 + i, 72, 2));
  const r = dailyQueue([...done, ...many(30)], now);
  assert.equal(r.queue.length, 5);
  assert.equal(r.waiting, 25);
});

test("cap used up leaves nothing, but a card marked Again today stays", () => {
  const done = Array.from({ length: 20 }, (_, i) => word(100 + i, 72, 2));
  const again = word(200, -1, 1);
  const r = dailyQueue([...done, again, ...many(3)], now);
  assert.deepEqual(r.queue.map((w) => w.base), ["w200"]);
  assert.equal(r.waiting, 3);
});

test("review note wording", () => {
  assert.equal(reviewNote(20, 12), "20 to review today. The other 12 can wait.");
  assert.equal(reviewNote(5, 0), "5 to review today.");
  assert.equal(reviewNote(0, 0), "Nothing to review today.");
});

test("repairWords gives a fresh card to words that lost theirs", () => {
  const good = { base: "猫", card: newCard() };
  const out = repairWords({ 猫: good, 犬: { reading: "いぬ" }, 魚: { card: { due: "nope" } }, bad: null });
  assert.equal(out.猫.card, good.card);
  assert.ok(isDue(out.犬.card));
  assert.equal(out.犬.base, "犬");
  assert.deepEqual(out.犬.glosses, []);
  assert.ok(!Number.isNaN(new Date(out.魚.card.due).getTime()));
  assert.equal("bad" in out, false);
  assert.deepEqual(repairWords(undefined), {});
});
