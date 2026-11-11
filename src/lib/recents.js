// Recent videos: names, numbers and timestamps only. Never media or subtitles.
// Stored under one localStorage key; storage can throw, so every call is guarded.

export const RECENTS_KEY = "mimitori:recents";
export const MAX_RECENTS = 12;

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Adds or updates the entry with this key, keeps untouched fields from the old
// one, then sorts newest first and trims. Returns a new array.
export function upsertRecent(list, patch, now = Date.now(), max = MAX_RECENTS) {
  const old = list.find((r) => r.key === patch.key);
  const next = { ...old, ...patch, watchedAt: patch.watchedAt ?? now };
  return [next, ...list.filter((r) => r.key !== patch.key)].sort((a, b) => b.watchedAt - a.watchedAt).slice(0, max);
}

// IndexedDB key of an entry's poster frame.
export const posterKey = (key) => `recent:${key}`;

// Keys that were in `prev` but are gone from `next` (trimmed out), so their posters can go too.
export const droppedKeys = (prev, next) => prev.filter((p) => !next.some((n) => n.key === p.key)).map((p) => p.key);

// A poster is due once ~30 s have passed since the last one, or straight away when forced.
export const posterDue = (lastAt, now = Date.now(), force = false) => force || now - lastAt >= 30000;

// Drops anything that isn't a usable entry.
export function cleanRecents(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r.key === "string" && typeof r.name === "string")
    .map((r) => ({
      key: r.key,
      name: r.name,
      coverage: num(r.coverage),
      positionS: num(r.positionS),
      durationS: num(r.durationS),
      watchedAt: num(r.watchedAt) ?? 0,
    }))
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .slice(0, MAX_RECENTS);
}

export function loadRecents(storage = globalThis.localStorage) {
  try {
    return cleanRecents(JSON.parse(storage.getItem(RECENTS_KEY)));
  } catch {
    return [];
  }
}

export function saveRecents(list, storage = globalThis.localStorage) {
  try {
    storage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    /* nothing to do: the list just won't survive a reload */
  }
}

// 252 -> "4:12", 3725 -> "1:02:05"
export function formatClock(s) {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// "Stopped at 4:12 of 23:40", or "" when there is no place to carry on from.
export function stoppedLabel(r) {
  if (!r.positionS || r.positionS < 1) return "";
  const at = `Stopped at ${formatClock(r.positionS)}`;
  return r.durationS ? `${at} of ${formatClock(r.durationS)}` : at;
}

// Where to seek after the learner picks a file for this row: only the same file counts.
export function resumeAt(row, pickedKey) {
  return row.key === pickedKey && row.positionS >= 3 ? row.positionS : null;
}
