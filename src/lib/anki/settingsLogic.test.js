import test from "node:test";
import assert from "node:assert/strict";
import { ankiMode, buildMapping, flatFields, lowConfidence, templateParts } from "./settingsLogic.js";

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
