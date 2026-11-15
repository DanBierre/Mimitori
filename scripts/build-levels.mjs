// Builds public/dict/levels.json: the JLPT level of each word form, and which
// forms JMdict marks as common (as Jisho does), shown as small tags in Words.
//
//   node scripts/build-levels.mjs <JMdict_e.gz> <folder with n1.csv … n5.csv>
//
// JLPT lists: Jonathan Waller's JLPT Resources (tanos.co.uk), CC BY, with JMdict
// entry numbers added by github.com/stephenmk/yomitan-jlpt-vocab (original_data/).
// Common: JMdict news1, ichi1, spec1, spec2 and gai1 marks. JMdict is © the Electronic
// Dictionary Research and Development Group, CC BY-SA 4.0.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

// csvs: { 5: "jmdict_seq,kana,kanji,…\n…", … } -> Map(seq -> level). Easiest level wins.
export function jlptBySeq(csvs) {
  const out = new Map();
  for (const [level, text] of Object.entries(csvs)) {
    for (const line of text.split(/\r?\n/).slice(1)) {
      const seq = line.split(",")[0];
      if (/^\d+$/.test(seq)) out.set(seq, Math.max(out.get(seq) || 0, Number(level)));
    }
  }
  return out;
}

// Returns { jlpt: { "5": [forms] … }, common: [forms] }.
// A kana form shared by several entries (かみ: 紙, 神, 髪) keeps the easiest level.
export function buildLevels(xmlText, jlpt) {
  const best = new Map(); // form -> { level, common }
  for (const [entry] of xmlText.matchAll(/<entry>[\s\S]*?<\/entry>/g)) {
    const seq = entry.match(/<ent_seq>(\d+)<\/ent_seq>/)?.[1];
    const level = jlpt.get(seq) || 0;
    // Each spelling carries its own marks, so a rare spelling of a common word isn't "common".
    for (const [el] of entry.matchAll(/<[kr]_ele>[\s\S]*?<\/[kr]_ele>/g)) {
      const form = el.match(/<(?:keb|reb)>([^<]+)</)?.[1];
      const common = /<(?:ke|re)_pri>(?:news1|ichi1|spec1|spec2|gai1)</.test(el);
      if (!form || (!level && !common)) continue;
      const prev = best.get(form) || { level: 0, common: false };
      best.set(form, { level: Math.max(prev.level, level), common: prev.common || common });
    }
  }
  const out = { jlpt: {}, common: [] };
  for (const [form, { level, common }] of [...best].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (level) (out.jlpt[level] ||= []).push(form);
    if (common) out.common.push(form);
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, csvDir] = process.argv.slice(2);
  if (!input || !csvDir) {
    console.error("Usage: node scripts/build-levels.mjs <JMdict_e.gz> <folder with n1.csv … n5.csv>");
    process.exit(1);
  }
  let buf = readFileSync(input);
  if (input.endsWith(".gz")) buf = gunzipSync(buf);
  const csvs = Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, readFileSync(join(csvDir, `n${n}.csv`), "utf8")]));
  const levels = buildLevels(buf.toString("utf8"), jlptBySeq(csvs));
  const out = resolve(dirname(fileURLToPath(import.meta.url)), "../public/dict/levels.json");
  writeFileSync(out, JSON.stringify(levels));
  const n = Object.values(levels.jlpt).reduce((s, a) => s + a.length, 0);
  console.log(`${n} JLPT forms, ${levels.common.length} common forms -> ${out}`);
}
