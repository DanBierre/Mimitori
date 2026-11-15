// progress.js
// The quiet "this week" line on Review: reviews done, words saved, words marked
// known, and how many days in a row the learner has reviewed.

// Local calendar day, so a late-night review counts for the day it felt like.
export function dayKey(time) {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The last 7 calendar days, today first. Steps by date, not by 24 h, so DST can't skip a day.
function lastDays(now, n) {
  const d = new Date(now);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(dayKey(d));
    d.setDate(d.getDate() - 1);
  }
  return out;
}

export function weekStats({ log = {}, words = {}, known = {} }, now = Date.now()) {
  const days = lastDays(now, 7);
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const since = start.getTime();

  const reviews = days.reduce((sum, day) => sum + (log[day] || 0), 0);
  const saved = Object.values(words).filter((w) => (w?.addedAt || 0) >= since).length;
  // Older data stores `true` instead of a time; those can't count for this week.
  const learnt = Object.values(known).filter((at) => typeof at === "number" && at >= since).length;

  // Days in a row with a review, ending today (or yesterday, if today's isn't done yet).
  let streak = 0;
  const d = new Date(now);
  if (!log[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (log[dayKey(d)]) {
    streak++;
    d.setDate(d.getDate() - 1);
  }

  return { reviews, saved, learnt, streak };
}

// Adds one review to today's count. Keeps the log to the last 400 days.
export function logReview(log = {}, now = Date.now()) {
  const day = dayKey(now);
  const next = { ...log, [day]: (log[day] || 0) + 1 };
  const keys = Object.keys(next);
  if (keys.length > 400) keys.sort().slice(0, keys.length - 400).forEach((k) => delete next[k]);
  return next;
}
