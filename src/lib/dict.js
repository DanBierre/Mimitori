// dict.js
// Offline word lookup against a compact JMdict extract served from
// /dict/jmdict-lite.json (built by scripts/build-jmdict.mjs). Loaded lazily on
// first lookup. If the file isn't there yet, lookups return null and the UI
// says the dictionary isn't installed instead of failing.
//
// File shape: { "食べる": [{ r: "たべる", g: ["to eat", ...], p: ["v1", "vt"] }], ... }
// keyed by both kanji forms and kana forms.

const DICT_URL = "/dict/jmdict-lite.json";

let dictPromise = null;
let dictStatus = "idle"; // idle | loading | ready | missing

export function getDictStatus() {
  return dictStatus;
}

export function loadDict() {
  if (!dictPromise) {
    dictStatus = "loading";
    dictPromise = fetch(DICT_URL)
      .then((res) => {
        const type = res.headers.get("content-type") || "";
        if (!res.ok || type.includes("text/html")) throw new Error("missing");
        return res.json();
      })
      .then((data) => {
        dictStatus = "ready";
        return data;
      })
      .catch(() => {
        dictStatus = "missing";
        return null;
      });
  }
  return dictPromise;
}

const POS_LABELS = {
  n: "noun", "adj-i": "i-adjective", "adj-na": "na-adjective", adv: "adverb",
  v1: "verb (ichidan)", v5: "verb (godan)", vs: "suru verb", vt: "transitive",
  vi: "intransitive", prt: "particle", conj: "conjunction", exp: "expression",
  int: "interjection", pn: "pronoun", ctr: "counter", pref: "prefix", suf: "suffix",
};

function prettyPos(tags) {
  const seen = new Set();
  const out = [];
  for (const tag of tags || []) {
    const key = tag.startsWith("v5") ? "v5" : tag;
    const label = POS_LABELS[key];
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out.slice(0, 3);
}

// Looks up a token by its dictionary form, falling back to the surface form
// and then the reading. Returns { reading, glosses, pos } or null.
export async function lookupWord({ base, surface, reading }) {
  const dict = await loadDict();
  if (!dict) return null;
  const entries = dict[base] || dict[surface] || (reading && dict[reading]) || null;
  if (!entries || !entries.length) return null;
  const best = entries[0];
  return {
    reading: best.r,
    glosses: best.g.slice(0, 4),
    pos: prettyPos(best.p),
    alternatives: entries.slice(1, 3).map((e) => ({ reading: e.r, glosses: e.g.slice(0, 2) })),
  };
}
