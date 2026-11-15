import { test } from "node:test";
import assert from "node:assert/strict";
import { dayKey, logReview, weekStats } from "./progress.js";

const now = new Date(2026, 10, 15, 21, 0).getTime();
const daysAgo = (n, h = 12) => new Date(2026, 10, 15 - n, h).getTime();

test("counts this week's reviews, saves and known words", () => {
  const log = { [dayKey(daysAgo(0))]: 5, [dayKey(daysAgo(6))]: 2, [dayKey(daysAgo(7))]: 9 };
  const words = { 駅: { addedAt: daysAgo(1) }, 雨: { addedAt: daysAgo(8) }, 傘: {} };
  const known = { 猫: daysAgo(2), 犬: true, 鳥: daysAgo(10) };
  assert.deepEqual(weekStats({ log, words, known }, now), { reviews: 7, saved: 1, learnt: 1, streak: 1 });
});

test("streak runs back from today, or from yesterday if today isn't done", () => {
  const log = { [dayKey(daysAgo(1))]: 1, [dayKey(daysAgo(2))]: 3, [dayKey(daysAgo(4))]: 1 };
  assert.equal(weekStats({ log }, now).streak, 2);
  assert.equal(weekStats({ log: { ...log, [dayKey(now)]: 1 } }, now).streak, 3);
  assert.equal(weekStats({}, now).streak, 0);
});

test("logReview adds to today and keeps the log short", () => {
  assert.deepEqual(logReview({ [dayKey(now)]: 2 }, now), { [dayKey(now)]: 3 });
  const big = Object.fromEntries(Array.from({ length: 401 }, (_, i) => [`2020-01-${String(i).padStart(3, "0")}`, 1]));
  assert.equal(Object.keys(logReview(big, now)).length, 400);
});
