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
