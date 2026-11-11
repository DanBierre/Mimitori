import test from "node:test";
import assert from "node:assert/strict";
import { weekForecast, savedThisWeek } from "./forecast.js";

const w = (due, addedAt) => ({ card: { due }, addedAt });

test("week starts Monday and folds overdue into today", () => {
  const now = new Date(2026, 10, 11, 10); // Wed 11 Nov 2026
  const words = [
    w(new Date(2026, 10, 9, 8)), // Mon, already gone: counts today
    w(new Date(2026, 10, 11, 23)), // today
    w(new Date(2026, 10, 13, 1)), // Fri
    w(new Date(2026, 10, 15, 22)), // Sun
    w(new Date(2026, 10, 16, 1)), // next Mon: not shown
    w(new Date(2026, 9, 1)), // long overdue
  ];
  const f = weekForecast(words, now);
  assert.deepEqual(f.map((d) => d.label), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  assert.deepEqual(f.map((d) => d.count), [0, 0, 3, 0, 1, 0, 1]);
  assert.equal(f.find((d) => d.today).label, "Wed");
});

test("Sunday is the last day of the week", () => {
  const f = weekForecast([w(new Date(2026, 10, 15, 9))], new Date(2026, 10, 15, 9));
  assert.equal(f[6].today, true);
  assert.equal(f[6].count, 1);
});

test("saved this week counts stamped words from the last 7 days", () => {
  const now = Date.now();
  assert.equal(savedThisWeek([w(0, now - 1000), w(0, now - 8 * 864e5), w(0)], now), 1);
});
