// settingsLogic.js
// Pure helpers behind the Settings screen and the store (unit-tested).

import { isDue } from "../srs.js";
import { commonSet } from "../common.js";
import { deckQuery } from "./known.js";

export const ROLE_LABELS = {
  expression: "Word",
  reading: "Reading",
  meaning: "Meaning",
  sentence: "Sentence",
  sentenceFurigana: "Sentence with furigana",
  sentenceTranslation: "Sentence translation",
  picture: "Picture",
  sentenceAudio: "Sentence audio",
  source: "Source",
  template: "Layout",
};

const SLOT_LABELS = { expression: "Word", reading: "Reading", meaning: "Meaning", sentenceAudio: "Audio", picture: "Picture" };

// Anki mode is on only when the toggle is on and setup is complete.
export function ankiMode(state) {
  const a = state.settings?.anki;
  return Boolean(a && a.enabled && a.deck && a.model && Object.keys(a.mapping || {}).length > 0);
}

// notesInfo entry -> { [field]: value }
export const flatFields = (note) =>
  Object.fromEntries(Object.entries(note.fields).map(([k, f]) => [k, f.value]));

// Splits a learned layout into slots (chips) and literal glue (text).
export function templateParts(template) {
  return template
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^\{(\w+)\}$/);
      if (m) return { slot: SLOT_LABELS[m[1]] || m[1] };
      return { text: p.replace(/<br\s*\/?>/gi, " / ").replace(/<[^>]*>/g, "") };
    });
}

// Rows the learner confirmed -> the mapping saved in settings.
// roles: { [field]: role | "none" }, guesses: guessFieldRoles output.
export function buildMapping(fieldNames, guesses, roles) {
  const mapping = {};
  for (const f of fieldNames) {
    const role = roles[f];
    if (!role || role === "none") continue;
    const g = guesses[f] || {};
    const same = g.role === role;
    const entry = { role, format: same ? g.format ?? null : role === "reading" ? "kana" : role === "meaning" ? "plain" : null };
    if (role === "template") entry.template = g.template;
    mapping[f] = entry;
  }
  return mapping;
}

export const lowConfidence = (g) => !g || g.confidence < 0.7;

// The learner can't save a mapping that has no way to find the word.
export const hasWordField = (mapping) =>
  Object.values(mapping).some((m) => m.role === "expression" || m.role === "template");

// "known" | "due" | "saved" | "inAnki" | "new". Known (app or Anki) first, then Anki's deck beats "saved".
export function wordState(state, base, now = new Date(), common = commonSet()) {
  if (state.known[base]) return "known";
  if (state.anki.known[base]) return "known";
  if (state.anki.inDeck[base]) return "inAnki";
  const word = state.words[base];
  if (word) return isDue(word.card, now) ? "due" : "saved";
  return state.settings?.commonKnown !== false && common.has(base) ? "known" : "new";
}

// Where to learn a note type's layout from: its cards in the deck if there are
// enough, otherwise its cards anywhere (the layout belongs to the type).
export const MIN_DECK_SAMPLES = 5;
export function pickSampleQuery({ deckCount, deck, model }) {
  return deckCount >= MIN_DECK_SAMPLES
    ? { query: `${deckQuery(deck)} "note:${model}"`, scope: "deck" }
    : { query: `"note:${model}"`, scope: "collection" };
}

// The add-to deck first, then the picked read decks, no duplicates or blanks.
export const readDecks = (a) => [...new Set([a.deck, ...(a.readDecks ?? [])].filter(Boolean))];
