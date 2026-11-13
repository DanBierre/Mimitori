import { JAPANESE_REGEX } from "../furigana.js";
import { guessFieldRoles } from "./fieldRoles.js";
import { readDecks } from "./settingsLogic.js";

export const cleanExpression = (v) =>
  v
    .replace(/\[sound:[^\]]*\]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, "");

const valid = (w) => w.length > 0 && w.length <= 12 && JAPANESE_REGEX.test(w) && !/[A-Za-z=()<>\[\]]/.test(w);

const entries = (mapping, role) => Object.entries(mapping).filter(([, m]) => m.role === role);

export function wordFromNote(fields, mapping) {
  for (const [name] of entries(mapping, "expression")) {
    const w = cleanExpression(fields[name] ?? "");
    if (w) return w;
  }
  for (const [name, m] of entries(mapping, "template")) {
    if (!(m.template ?? "").includes("{expression}")) continue;
    const text = (fields[name] ?? "").normalize("NFKC");
    const cut = text.search(/\(|=|<br\s*\/?>/i);
    const w = cleanExpression(cut >= 0 ? text.slice(0, cut) : text);
    if (valid(w)) return w;
  }
  for (const [name] of entries(mapping, "sentence")) {
    const bold = [...(fields[name] ?? "").matchAll(/<b>(.*?)<\/b>/gis)].map((x) => x[1]).join("");
    const w = cleanExpression(bold);
    if (w) return w;
  }
  return "";
}

// Anki search for one deck. Inside quotes \ " * _ still need a backslash.
export const deckQuery = (deck) => `"deck:${deck.replace(/[\\"*_]/g, "\\$&")}"`;

// Like deckQuery, minus subdecks (the trailing ::* stays a real wildcard).
export const deckOnlyQuery = (deck) => `${deckQuery(deck)} -${deckQuery(deck).slice(0, -1)}::*"`;

// Deck notes kept for display: "wasn't found" notes stay until the learner changes the decks.
export const mergeDeckNotes = (prev, next) => [
  ...new Set([...prev.filter((n) => n.endsWith("wasn't found in Anki")), ...next]),
];

// Notes of one deck with their word, tags, whether the card is mature and whether all cards are suspended.
// Notes with no word are left out. Independent of the store.
export async function readDeckNotes(anki, { deck, model, mapping }, onProgress) {
  const base = deckQuery(deck);
  const ids = await anki.invoke("findNotes", { query: base });
  const matureIds = new Set(await anki.invoke("findNotes", { query: `${base} prop:ivl>=21` }));
  const susp = new Set(await anki.invoke("findCards", { query: `${base} is:suspended` }));
  const infos = [];
  for (let i = 0; i < ids.length; i += 500) {
    infos.push(...(await anki.invoke("notesInfo", { notes: ids.slice(i, i + 500) })));
    onProgress?.(Math.min(i + 500, ids.length), ids.length);
  }
  const flat = (n) => Object.fromEntries(Object.entries(n.fields).map(([k, f]) => [k, f.value]));
  const byModel = {};
  for (const n of infos) (byModel[n.modelName] ||= []).push(n);
  const out = [];
  for (const [modelName, notes] of Object.entries(byModel)) {
    let map = modelName === model ? mapping : null;
    if (!map) {
      // guessed once per model from the whole deck, so mature and other notes share it
      const names = Object.entries(notes[0].fields).sort((a, b) => a[1].order - b[1].order).map(([k]) => k);
      map = guessFieldRoles(names, notes.slice(0, 20).map(flat));
    }
    for (const n of notes) {
      const word = wordFromNote(flat(n), map);
      if (word) out.push({
          noteId: n.noteId,
          word,
          tags: n.tags ?? [],
          cards: n.cards ?? [],
          mature: matureIds.has(n.noteId),
          suspended: (n.cards ?? []).length > 0 && n.cards.every((id) => susp.has(id)),
        });
    }
  }
  return out;
}

export async function fetchDeckWords(anki, cfg, onProgress) {
  let notes = 0;
  const list = await readDeckNotes(anki, cfg, (done, total) => {
    notes = total;
    onProgress?.(done, total);
  });
  const known = {};
  const inDeck = {};
  for (const n of list) (n.mature || n.suspended ? known : inDeck)[n.word] = true;
  for (const w of Object.keys(known)) delete inDeck[w];
  return { known, inDeck, notes, words: list.length };
}

// Known in any deck is known; otherwise in any deck is inDeck.
export function mergeDeckWords(results) {
  const known = {};
  const inDeck = {};
  for (const r of results) {
    Object.assign(known, r.known);
    Object.assign(inDeck, r.inDeck);
  }
  for (const w of Object.keys(known)) delete inDeck[w];
  return { known, inDeck };
}

// Reads every deck in order. A deck missing from Anki is skipped (and returned in
// `missing`) so it can't break the others. Only the add-to deck uses the stored
// model/mapping; other decks guess their note-type roles.
export async function readAllDecks(anki, a, onProgress) {
  const names = await anki.invoke("deckNames");
  const results = [];
  const deckNotes = [];
  const missing = [];
  for (const deck of readDecks(a)) {
    if (!names.includes(deck)) {
      deckNotes.push(`${deck} wasn't found in Anki`);
      missing.push(deck);
      continue;
    }
    const own = deck === a.deck;
    const r = await fetchDeckWords(
      anki,
      { deck, model: own ? a.model : "", mapping: own ? a.mapping : {} },
      (done, total) => onProgress?.({ deck, done, total })
    );
    if (r.notes > 0 && r.words === 0) deckNotes.push(`Couldn't find the word field in ${deck}`);
    results.push(r);
  }
  return { merged: mergeDeckWords(results), deckNotes, missing };
}
