// Builds public/dict/common.json: kanji and kana forms of JMdict entries marked
// nf01-nf04 (the most common ~2,000 words by newspaper frequency).
//
//   node scripts/build-common.mjs <path-to-JMdict_e.gz or .xml>
//
// Source: http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz
// JMdict is © the Electronic Dictionary Research and Development Group, CC BY-SA 4.0.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

export function commonForms(xmlText, maxBand = 4) {
  const out = new Set();
  const nf = new RegExp(`<(?:ke|re)_pri>nf0[1-${maxBand}]</(?:ke|re)_pri>`);
  for (const [entry] of xmlText.matchAll(/<entry>[\s\S]*?<\/entry>/g)) {
    if (!nf.test(entry)) continue;
    for (const m of entry.matchAll(/<(?:keb|reb)>([^<]+)<\/(?:keb|reb)>/g)) out.add(m[1]);
  }
  return [...out].sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node scripts/build-common.mjs <path-to-JMdict_e.gz or .xml>");
    process.exit(1);
  }
  let buf = readFileSync(input);
  if (input.endsWith(".gz")) buf = gunzipSync(buf);
  const xml = buf.toString("utf8");
  const entries = (xml.match(/<entry>[\s\S]*?<\/entry>/g) || []).filter((e) => /<(?:ke|re)_pri>nf0[1-4]</.test(e)).length;
  const forms = commonForms(xml);
  const out = resolve(dirname(fileURLToPath(import.meta.url)), "../public/dict/common.json");
  writeFileSync(out, JSON.stringify(forms));
  console.log(`${entries} entries, ${forms.length} forms -> ${out}`);
}
