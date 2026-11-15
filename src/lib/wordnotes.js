// wordnotes.js
// Pitch accent and kanji parts for the word card, from tables built by
// scripts/build-wordnotes.mjs. Each table loads once, the first time a card needs it.

const tables = {};

export function loadTable(name, fetchImpl = fetch) {
  tables[name] ||= fetchImpl(`/dict/${name}.json`)
    .then((res) => (res.ok && !(res.headers?.get("content-type") || "").includes("text/html") ? res.json() : {}))
    .catch(() => {
      delete tables[name]; // offline: try again on the next card
      return {};
    });
  return tables[name];
}

const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

// "きょう" -> ["きょ", "う"]: small kana join the mora before them.
export function moras(kana) {
  const out = [];
  for (const c of kana) {
    if (/[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ]/.test(c) && out.length) out[out.length - 1] += c;
    else out.push(c);
  }
  return out;
}

// The accent for this word read this way, from a "reading:0,2|reading:1" entry. -1 when unknown.
export function accentFor(entry, reading) {
  if (!entry) return -1;
  const parts = entry.split("|").map((p) => p.split(":"));
  const want = toHira(reading || "");
  const hit = parts.find(([r]) => toHira(r) === want) || (parts.length === 1 && !want ? parts[0] : null);
  return hit ? Number(hit[1].split(",")[0]) : -1;
}

// Tokyo pitch: accent 0 rises after the first mora and stays up; accent n drops after mora n.
// Returns [{ mora, high, drop }], drop marking the last high mora before the fall.
export function pitchMarks(reading, accent) {
  const ms = moras(reading);
  return ms.map((mora, i) => {
    const n = i + 1;
    const high = accent === 0 ? n > 1 : accent === 1 ? n === 1 : n > 1 && n <= accent;
    return { mora, high, drop: accent > 0 && n === accent };
  });
}

// Kanji in the word, each with its table row, in order and without repeats.
export function kanjiParts(word, table) {
  const seen = new Set();
  const out = [];
  for (const c of word || "") {
    if (!table[c] || seen.has(c)) continue;
    seen.add(c);
    const [meaning, on, kun] = table[c];
    out.push({ kanji: c, meaning, on, kun });
  }
  return out;
}
