// Counts for the Watch "Today" column. Pure, so they can be tested.

const DAY = 24 * 3600 * 1000;
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Cards falling due on each day of this week, Monday first (NZ week).
// Days already gone show 0; anything overdue counts toward today.
export function weekForecast(words, now = new Date()) {
  const todayIdx = (now.getDay() + 6) % 7;
  const monday = startOfDay(now);
  monday.setDate(monday.getDate() - todayIdx);
  const counts = new Array(7).fill(0);
  for (const w of words) {
    const due = new Date(w.card.due);
    const idx = Math.floor((startOfDay(due) - monday) / DAY + 0.5);
    if (idx > 6) continue;
    counts[Math.max(idx, todayIdx)]++;
  }
  return DAY_LABELS.map((label, i) => ({ label, count: counts[i], today: i === todayIdx }));
}

// Words saved (with an addedAt stamp) in the last 7 days.
export function savedThisWeek(words, now = Date.now()) {
  return words.filter((w) => typeof w.addedAt === "number" && now - w.addedAt < 7 * DAY).length;
}
