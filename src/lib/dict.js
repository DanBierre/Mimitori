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
        dictPromise = null; // let the next lookup try again
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
  const key = lookupKeys({ base, surface, reading }).find((k) => dict[k]?.length);
  const entries = key ? dict[key] : null;
  if (!entries) return null;
  const i = pickEntry(entries, reading);
  const best = entries[i];
  // Found through the plain word (世話 for お世話): keep the reading of the polite form itself.
  const viaPlain = ![base, surface, reading].includes(key);
  return {
    reading: viaPlain && reading ? toHira(reading) : best.r,
    glosses: best.g.slice(0, 4),
    pos: prettyPos(best.p),
    alternatives: entries.filter((_, j) => j !== i).slice(0, 2).map((e) => ({ reading: e.r, glosses: e.g.slice(0, 2) })),
  };
}

// Keys to try, in order: dictionary form, the form in the text, the reading. Polite お/ご/御 forms
// JMdict doesn't list (お世話) fall back to the plain word (世話).
export function lookupKeys({ base, surface, reading }) {
  const keys = [base, surface, reading].filter(Boolean);
  const plain = /^[おご御](?=[㐀-鿿])/.test(base || "") ? base.slice(1) : null;
  return plain ? [...keys, plain] : keys;
}

const toHira = (s) => (s || "").replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

// Which entry fits how the word was read in the text: 降る read ふる is "to fall", not くだる "to descend".
// The token's reading is of the form in the text (降った → ふった), so the longest shared start wins;
// ties keep JMdict's own order.
export function pickEntry(entries, reading) {
  const r = toHira(reading);
  let best = 0;
  let top = 0;
  entries.forEach((e, i) => {
    const er = toHira(e.r);
    let n = 0;
    while (n < er.length && n < r.length && er[n] === r[n]) n++;
    if (n > top) [best, top] = [i, n];
  });
  return best;
}
