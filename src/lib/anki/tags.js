import { readDeckNotes, deckQuery, deckOnlyQuery } from "./known.js";

export const TAG = "mimitori-known";
export const SUSPEND_TAG = "mimitori-suspended";

const hasTag = (n) => n.tags.some((t) => t.toLowerCase() === TAG);

export function planTags(notes, known) {
  const add = [];
  const remove = [];
  for (const n of notes) {
    const tagged = hasTag(n);
    const isKnown = Object.hasOwn(known, n.word) && known[n.word];
    if (isKnown && !tagged) add.push(n.noteId);
    else if (!isKnown && tagged) remove.push(n.noteId);
  }
  return { add, remove };
}

// Tags notes in the add-to deck only: reads that deck alone and writes only addTags/removeTags.
export async function syncTags(anki, ankiSettings, known) {
  if (!ankiSettings.deck) return { added: 0, removed: 0 };
  const notes = await readDeckNotes(anki, {
    deck: ankiSettings.deck,
    model: ankiSettings.model,
    mapping: ankiSettings.mapping,
  });
  // Tags are per note, so skip notes with a card outside the add-to deck (subdecks count as outside).
  const inDeck = new Set(await anki.invoke("findCards", { query: deckOnlyQuery(ankiSettings.deck) }));
  const own = notes.filter((n) => n.cards.length > 0 && n.cards.every((c) => inDeck.has(c)));
  const { add, remove } = planTags(own, known);
  if (add.length) await anki.invoke("addTags", { notes: add, tags: TAG });
  if (remove.length) await anki.invoke("removeTags", { notes: remove, tags: TAG });
  return { added: add.length, removed: remove.length };
}

// Reconciles Mimitori's known words with suspended cards. `suspendedIds` is a Set of card ids.
// Anki wins when the learner unsuspended a note we suspended (it goes in `unknow`).
// Never unsuspends a note that lacks our tag (the learner suspended it themselves).
export function planSuspend(notes, known, suspendedIds) {
  const suspend = [];
  const unsuspend = [];
  const untag = [];
  const unknow = [];
  for (const n of notes) {
    const tagged = n.tags.some((t) => t.toLowerCase() === SUSPEND_TAG);
    const isKnown = Boolean(known[n.word]);
    const allSusp = n.cards.every((c) => suspendedIds.has(c));
    if (isKnown && !tagged) suspend.push(n);
    else if (isKnown && tagged && !allSusp) {
      untag.push(n.noteId);
      unknow.push(n.word);
    } else if (!isKnown && tagged) {
      unsuspend.push(n);
      untag.push(n.noteId);
    }
  }
  return { suspend, unsuspend, untag, unknow };
}

// Suspends or unsuspends notes in the add-to deck only (same own-note filter as syncTags).
export async function syncSuspend(anki, ankiSettings, known) {
  const none = { suspended: 0, unsuspended: 0, unknow: [], words: {} };
  const deck = ankiSettings.deck;
  if (!deck) return none;
  const notes = await readDeckNotes(anki, { deck, model: ankiSettings.model, mapping: ankiSettings.mapping });
  const inDeck = new Set(await anki.invoke("findCards", { query: deckOnlyQuery(deck) }));
  const own = notes.filter((n) => n.cards.length > 0 && n.cards.every((c) => inDeck.has(c)));
  const susp = new Set(await anki.invoke("findCards", { query: `${deckQuery(deck)} is:suspended` }));
  const p = planSuspend(own, known, susp);
  const cards = (list) => list.flatMap((n) => n.cards);
  if (p.suspend.length) {
    await anki.invoke("suspend", { cards: cards(p.suspend) });
    await anki.invoke("addTags", { notes: p.suspend.map((n) => n.noteId), tags: SUSPEND_TAG });
  }
  if (p.unsuspend.length) await anki.invoke("unsuspend", { cards: cards(p.unsuspend) });
  if (p.untag.length) await anki.invoke("removeTags", { notes: p.untag, tags: SUSPEND_TAG });
  // What Anki now says about each touched word: suspended = known, unsuspended = back to its maturity.
  const words = {};
  p.suspend.forEach((n) => (words[n.word] = "known"));
  p.unsuspend.forEach((n) => (words[n.word] = n.mature ? "known" : "inDeck"));
  return { suspended: p.suspend.length, unsuspended: p.unsuspend.length, unknow: p.unknow, words };
}
