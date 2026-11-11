// Japanese greeting by local hour, with the learner's optional name.
export function greeting(date = new Date(), name = "") {
  const h = date.getHours();
  const word = h >= 5 && h < 11 ? "おはよう" : h >= 11 && h < 17 ? "こんにちは" : "こんばんは";
  const n = name.trim();
  return n ? `${word}、${n}` : word;
}

const WEEK = 7 * 24 * 3600 * 1000;

// Words saved, or marked known, in the last 7 days. Known words only carry a
// date when marked in this version or later; older ones are simply not counted.
export function addedThisWeek(state, now = Date.now()) {
  const recent = (t) => typeof t === "number" && now - t < WEEK;
  return (
    Object.values(state.words).filter((w) => recent(w.addedAt)).length +
    Object.values(state.known).filter(recent).length
  );
}
