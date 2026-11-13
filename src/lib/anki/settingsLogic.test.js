import test from "node:test";
import assert from "node:assert/strict";
import { newCard } from "../srs.js";
import { pickSampleQuery, hasWordField, wordState, ankiMode, buildMapping, flatFields, lowConfidence, templateParts, readDecks } from "./settingsLogic.js";

const st = (anki) => ({ settings: { anki } });

test("ankiMode needs enabled, deck, model and a mapping", () => {
  const ok = { enabled: true, deck: "Test", model: "M", mapping: { A: { role: "expression" } } };
  assert.equal(ankiMode(st(ok)), true);
  assert.equal(ankiMode(st({ ...ok, enabled: false })), false);
  assert.equal(ankiMode(st({ ...ok, deck: "" })), false);
  assert.equal(ankiMode(st({ ...ok, mapping: {} })), false);
  assert.equal(ankiMode({ settings: {} }), false);
});

test("flatFields flattens notesInfo fields", () => {
  assert.deepEqual(flatFields({ fields: { A: { value: "x", order: 0 }, B: { value: "y", order: 1 } } }), { A: "x", B: "y" });
});

test("templateParts splits slots from glue", () => {
  assert.deepEqual(templateParts("{expression}（{reading}）＝{meaning}<br><br>{picture}"), [
    { slot: "Word" }, { text: "（" }, { slot: "Reading" }, { text: "）＝" }, { slot: "Meaning" },
    { text: " /  / " }, { slot: "Picture" },
  ]);
});

test("buildMapping keeps guessed format and template, drops 'none'", () => {
  const guesses = {
    A: { role: "expression", format: null, confidence: 1 },
    B: { role: "template", template: "{expression}={meaning}", format: "plain", confidence: 0.9 },
    C: { role: "reading", format: "bracket", confidence: 1 },
    D: { role: null, confidence: 0 },
  };
  const m = buildMapping(["A", "B", "C", "D"], guesses, { A: "expression", B: "template", C: "meaning", D: "none" });
  assert.deepEqual(m, {
    A: { role: "expression", format: null },
    B: { role: "template", format: "plain", template: "{expression}={meaning}" },
    C: { role: "meaning", format: "plain" },
  });
});

test("lowConfidence flags under 0.7 and missing guesses", () => {
  assert.equal(lowConfidence({ confidence: 0.69 }), true);
  assert.equal(lowConfidence({ confidence: 0.7 }), false);
  assert.equal(lowConfidence(undefined), true);
});

test("hasWordField needs expression or template", () => {
  assert.equal(hasWordField({ A: { role: "meaning" } }), false);
  assert.equal(hasWordField({ A: { role: "expression" } }), true);
  assert.equal(hasWordField({ A: { role: "template" } }), true);
  assert.equal(hasWordField({}), false);
});

test("wordState: Anki known/inDeck beat saved", () => {
  const now = new Date();
  const due = { ...newCard(), due: new Date(now.getTime() - 1000) };
  const later = { ...newCard(), due: new Date(now.getTime() + 86400000) };
  const base = {
    known: { k: true },
    words: { d: { card: due }, s: { card: later }, p: { card: due }, q: { card: due } },
    anki: { known: { k: true, a: true, q: true }, inDeck: { i: true, a: true, p: true } },
  };
  assert.equal(wordState(base, "k", now), "known");
  assert.equal(wordState(base, "d", now), "due");
  assert.equal(wordState(base, "s", now), "saved");
  assert.equal(wordState(base, "a", now), "known");
  assert.equal(wordState(base, "i", now), "inAnki");
  assert.equal(wordState(base, "p", now), "inAnki"); // saved and in Anki's deck
  assert.equal(wordState(base, "q", now), "known"); // saved and known in Anki
  assert.equal(wordState(base, "z", now), "new");
});

test("pickSampleQuery uses the deck at 5+ notes, else the whole collection", () => {
  assert.deepEqual(pickSampleQuery({ deckCount: 5, deck: "D", model: "M" }), { query: '"deck:D" "note:M"', scope: "deck" });
  assert.deepEqual(pickSampleQuery({ deckCount: 4, deck: "D", model: "M" }), { query: '"note:M"', scope: "collection" });
  assert.deepEqual(pickSampleQuery({ deckCount: 0, deck: "D", model: "M" }), { query: '"note:M"', scope: "collection" });
});

const emptyState = (commonKnown) => ({ known: {}, words: {}, anki: { known: {}, inDeck: {} }, settings: { commonKnown } });

test("wordState: very common word is known when commonKnown is on", () => {
  const common = new Set(["何"]);
  assert.equal(wordState(emptyState(true), "何", new Date(), common), "known");
});

test("wordState: commonKnown off leaves it new", () => {
  const common = new Set(["何"]);
  assert.equal(wordState(emptyState(false), "何", new Date(), common), "new");
});

test("wordState: a saved very common word stays saved", () => {
  const now = new Date();
  const s = emptyState(true);
  s.words["何"] = { card: { ...newCard(), due: new Date(now.getTime() + 86400000) } };
  assert.equal(wordState(s, "何", now, new Set(["何"])), "saved");
});

test("readDecks puts the add-to deck first and drops duplicates", () => {
  assert.deepEqual(readDecks({ deck: "Test", readDecks: ["日本語一般で", "Test", ""] }), ["Test", "日本語一般で"]);
});
