// Builds public/dict/jmdict-lite.json from a jmdict-simplified English file.
//
//   node scripts/build-jmdict.mjs <path-to-jmdict-eng-*.json>
//
// Source: https://github.com/scriptin/jmdict-simplified (releases).
// JMdict is © the Electronic Dictionary Research and Development Group,
// CC BY-SA 4.0 (attribution is shown in the Words tab).
//
// Keeps only common entries (priority-tagged) to stay small, and indexes
// each by every kanji form and every kana form.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/build-jmdict.mjs <path-to-jmdict-eng.json>");
  process.exit(1);
}

const out = resolve(dirname(fileURLToPath(import.meta.url)), "../public/dict/jmdict-lite.json");
const { words } = JSON.parse(readFileSync(input, "utf8"));

const index = {};
let kept = 0;

function add(key, entry) {
  (index[key] ||= []).push(entry);
}

for (const w of words) {
  const common = w.kanji.some((k) => k.common) || w.kana.some((k) => k.common);
  if (!common) continue;

  const glosses = [];
  const pos = new Set();
  for (const s of w.sense.slice(0, 4)) {
    s.partOfSpeech.forEach((p) => pos.add(p));
    const text = s.gloss.filter((g) => g.lang === "eng").map((g) => g.text).slice(0, 3).join(", ");
    if (text) glosses.push(text);
  }
  if (!glosses.length) continue;

  const kana = w.kana.find((k) => k.common) || w.kana[0];
  const entry = { r: kana.text, g: glosses, p: [...pos] };
  kept++;

  for (const k of w.kanji) add(k.text, entry);
  for (const k of w.kana) add(k.text, entry);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(index));
console.log(`Wrote ${kept} common entries (${Object.keys(index).length} keys) to ${out}`);
