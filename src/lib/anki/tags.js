import { readDeckNotes, deckOnlyQuery } from "./known.js";

export const TAG = "mimitori-known";

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
