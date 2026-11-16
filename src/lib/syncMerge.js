// syncMerge.js
// Joins this device's words with the copy on the server. Pure, so tests run it in Node.
// Every change carries a time and the newest one wins, word by word, so two phones never
// overwrite each other. Removing a word or un-knowing one leaves a dated "gone" note, so
// the other copy can't bring it back.

const time = (v) => (typeof v === "number" ? v : new Date(v ?? 0).getTime() || 0);

// The last time a saved word changed: saved, reviewed, or put back with Undo.
export const wordTime = (w) => Math.max(time(w.addedAt), time(w.touched), time(w.card?.last_review));

// Per key, the entry with the later time.
function newest(a = {}, b = {}, timeOf = time) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) if (!(k in out) || timeOf(v) > timeOf(out[k])) out[k] = v;
  return out;
}

// The parts of the state that travel. Anki stays on each device: it's tied to that computer's Anki.
export const synced = (s) => ({
  words: s.words || {},
  known: s.known || {},
  log: s.log || {},
  gone: s.gone || {},
  goneKnown: s.goneKnown || {},
  settings: s.settings || {},
  settingsAt: s.settingsAt || 0,
});

// mine = this device's state, theirs = the server's copy. Returns the synced parts, joined.
export function mergeState(mine, theirs) {
  const a = synced(mine);
  const b = synced(theirs || {});
  const gone = newest(a.gone, b.gone);
  const goneKnown = newest(a.goneKnown, b.goneKnown);

  const words = {};
  for (const [base, w] of Object.entries(newest(a.words, b.words, wordTime))) {
    if (!(time(gone[base]) >= wordTime(w))) words[base] = w;
  }
  const known = {};
  for (const [base, at] of Object.entries(newest(a.known, b.known))) {
    // Un-known since, or saved again to study since
    if (time(goneKnown[base]) >= time(at)) continue;
    if (words[base] && time(words[base].addedAt) > time(at)) continue;
    known[base] = at;
  }
  // Each day's review count: the higher one. ponytail: two devices reviewing on the same day count as one; per-device counts if that matters
  const log = { ...a.log };
  for (const [day, n] of Object.entries(b.log)) log[day] = Math.max(log[day] || 0, n);

  const theirSettings = b.settingsAt > a.settingsAt;
  const settings = theirSettings ? { ...a.settings, ...b.settings, anki: a.settings.anki } : a.settings;
  return { words, known, log, gone, goneKnown, settings, settingsAt: Math.max(a.settingsAt, b.settingsAt) };
}
