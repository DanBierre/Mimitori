// Builds the two small tables the word card uses for its notes:
//   public/dict/pitch.json  { form: "reading:accent,accent|reading:accent" }
//   public/dict/kanji.json  { 字: ["meanings", "on readings", "kun readings"] }
//
//   node scripts/build-wordnotes.mjs <accents.txt> <kanjidic2.xml.gz>
//
// Pitch: Kanjium accents.txt (github.com/mifunetoshiro/kanjium), CC BY-SA 4.0.
// Only words in levels.json (JLPT or common) are kept, so the file stays small.
// Kanji: KANJIDIC2, © the Electronic Dictionary Research and Development Group, CC BY-SA 4.0.
// Only kanji with a school grade, JLPT level or frequency rank are kept.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

// accents.txt lines: "word<TAB>reading<TAB>0,2". keep(form) decides which words stay.
export function buildPitch(text, keep = () => true) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const [form, reading, accents] = line.split("\t");
    if (!form || !accents || !/^[\d,]+$/.test(accents) || !keep(form)) continue;
    const entry = `${reading || form}:${accents}`;
    out[form] = out[form] ? `${out[form]}|${entry}` : entry;
  }
  return out;
}

export function buildKanji(xml) {
  const out = {};
  for (const [c] of xml.matchAll(/<character>[\s\S]*?<\/character>/g)) {
    const literal = c.match(/<literal>([^<]+)</)?.[1];
    if (!literal || !/<(?:grade|jlpt|freq)>/.test(c)) continue;
    const all = (re) => [...c.matchAll(re)].map((m) => m[1]);
    const meanings = all(/<meaning>([^<]+)</g).slice(0, 3);
    if (!meanings.length) continue;
    // "-" marks a prefix or suffix use ("もの-"): dropped, then repeats removed.
    const clean = (list) => [...new Set(list.map((r) => r.replace(/^-|-$/g, "")))].slice(0, 3);
    const on = clean(all(/<reading r_type="ja_on">([^<]+)</g));
    // "た.べる" -> "た(べる)": the part after the dot is okurigana, written in kana after the kanji.
    const kun = clean(all(/<reading r_type="ja_kun">([^<]+)</g).map((k) => k.replace(/\.(.+)$/, "($1)")));
    out[literal] = [meanings.join(", "), on.join("、"), kun.join("、")];
  }
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [accents, kanjidic] = process.argv.slice(2);
  if (!accents || !kanjidic) {
    console.error("Usage: node scripts/build-wordnotes.mjs <accents.txt> <kanjidic2.xml.gz>");
    process.exit(1);
  }
  const dict = resolve(dirname(fileURLToPath(import.meta.url)), "../public/dict");
  const levels = JSON.parse(readFileSync(`${dict}/levels.json`, "utf8"));
  const forms = new Set([...Object.values(levels.jlpt).flat(), ...levels.common]);
  const pitch = buildPitch(readFileSync(accents, "utf8"), (f) => forms.has(f));
  writeFileSync(`${dict}/pitch.json`, JSON.stringify(pitch));
  let xml = readFileSync(kanjidic);
  if (kanjidic.endsWith(".gz")) xml = gunzipSync(xml);
  const kanji = buildKanji(xml.toString("utf8"));
  writeFileSync(`${dict}/kanji.json`, JSON.stringify(kanji));
  console.log(`${Object.keys(pitch).length} pitch words, ${Object.keys(kanji).length} kanji -> ${dict}`);
}
