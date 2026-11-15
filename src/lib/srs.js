// srs.js
// Spaced repetition scheduling via FSRS (ts-fsrs). Cards are stored as plain
// JSON in localStorage, so dates are revived on load.

import { createEmptyCard, fsrs, generatorParameters, Rating, State } from "ts-fsrs";

const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

export { Rating, State };

// A word counts as "known" once it has been scheduled this far out.
export const KNOWN_AFTER_DAYS = 21;

export function newCard(now = new Date()) {
  return createEmptyCard(now);
}

export function reviveCard(card) {
  return {
    ...card,
    due: new Date(card.due),
    last_review: card.last_review ? new Date(card.last_review) : undefined,
  };
}

export function isDue(card, now = new Date()) {
  return new Date(card.due).getTime() <= now.getTime();
}

// Returns the updated card for the given rating.
export function gradeCard(card, rating, now = new Date()) {
  return scheduler.next(reviveCard(card), now, rating).card;
}

// Human labels for what each grade would schedule ("10m", "3d", ...).
export function previewIntervals(card, now = new Date()) {
  const record = scheduler.repeat(reviveCard(card), now);
  const out = {};
  for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
    out[rating] = formatInterval(record[rating].card.due.getTime() - now.getTime());
  }
  return out;
}

export function formatInterval(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export function becameKnown(card) {
  return card.state === State.Review && card.scheduled_days >= KNOWN_AFTER_DAYS;
}

// At most this many cards are presented per day; extra due cards stay due and wait.
export const DAILY_CAP = 20;

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// words: saved words ({ card }). Cards already reviewed today count toward the cap;
// ones you marked Again today are due again and always stay in the queue.
export function dailyQueue(words, now = new Date(), cap = DAILY_CAP) {
  const due = words.filter((w) => isDue(w.card, now)).sort((a, b) => new Date(a.card.due) - new Date(b.card.due));
  const today = (w) => w.card.last_review && sameDay(new Date(w.card.last_review), now);
  const doneToday = words.filter((w) => !isDue(w.card, now) && today(w)).length;
  const again = due.filter(today);
  const room = Math.max(0, cap - doneToday - again.length);
  const queue = [...again, ...due.filter((w) => !today(w)).slice(0, room)];
  return { queue, waiting: due.length - queue.length };
}

export function reviewNote(shown, waiting) {
  const head = shown === 0 ? "Nothing to review today." : `${shown} to review today.`;
  return waiting > 0 ? `${head} The other ${waiting} can wait.` : head;
}

// A hand-edited or damaged backup can hold a word with no review card, which
// would crash the review queue and blank the app. Give such words a fresh card.
export function repairWords(words) {
  const out = {};
  for (const [base, w] of Object.entries(words || {})) {
    if (!w || typeof w !== "object") continue;
    const ok = w.card && !Number.isNaN(new Date(w.card.due).getTime());
    // A hand-edited backup can drop the meanings; Review and Words expect a list.
    const fixed = { ...w, base: w.base || base, glosses: Array.isArray(w.glosses) ? w.glosses : [] };
    out[base] = ok ? fixed : { ...fixed, card: newCard() };
  }
  return out;
}
