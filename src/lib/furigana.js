// furigana.js
// Ported from the original Chrome extension's content.js. Same tokenizer
// (kuromoji.js) and same dictionary data, now returning structured tokens so
// React can render real <ruby> elements.
//
// kuromoji is loaded as a plain global script (see index.html).

const KANJI_REGEX = /[一-龯]/;
export const JAPANESE_REGEX = /[぀-ヿ㐀-䶿一-鿿]/;

const KUROMOJI_DICT_PATH = "/dict/";

let tokenizerPromise = null;

export function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      // eslint-disable-next-line no-undef -- kuromoji is loaded as a global script, see index.html
      kuromoji.builder({ dicPath: KUROMOJI_DICT_PATH }).build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
    });
    // A failed load (offline, blocked) shouldn't stick: the next call retries.
    tokenizerPromise.catch(() => {
      tokenizerPromise = null;
    });
  }
  return tokenizerPromise;
}

function katakanaToHiragana(str) {
  return str.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

// Kanji runs get readings; 々 〆 ヵ ヶ behave like kanji inside words (人々, 三ヶ月).
const KANJI_RUN = /[一-龯々〆ヵヶ]+/g;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Splits a word so the reading sits over the kanji only:
// 食べ + たべ -> [{ text: "食", ruby: "た" }, { text: "べ" }].
// Kana in the word is matched against the reading to find where each kanji
// run's reading starts and ends. If that fails, the whole word gets the reading.
export function furiganaSegments(surface, reading) {
  if (!reading) return [{ text: surface }];
  const runs = [];
  let last = 0;
  for (const m of surface.matchAll(KANJI_RUN)) {
    if (m.index > last) runs.push({ kanji: false, text: surface.slice(last, m.index) });
    runs.push({ kanji: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < surface.length) runs.push({ kanji: false, text: surface.slice(last) });

  const pattern = runs.map((r) => (r.kanji ? "(.+?)" : escapeRegex(katakanaToHiragana(r.text)))).join("");
  const match = katakanaToHiragana(reading).match(new RegExp(`^${pattern}$`));
  if (!match) return [{ text: surface, ruby: reading }];

  let group = 1;
  return runs.map((r) => (r.kanji ? { text: r.text, ruby: match[group++] } : { text: r.text }));
}

// Parts of speech worth offering for lookup/saving. Particles, auxiliaries,
// symbols and fillers are skipped.
const CONTENT_POS = new Set(["名詞", "動詞", "形容詞", "副詞", "連体詞", "感動詞", "接続詞"]);

// Each token:
//   surface   text as written
//   reading   hiragana reading of the surface when it has kanji, else null
//   base      dictionary form (食べ -> 食べる)
//   pos       kuromoji part of speech
//   isWord    true for tokens worth looking up
export async function tokenizeWithReadings(text) {
  const tokenizer = await getTokenizer();
  const tokens = tokenizer.tokenize(text);

  return tokens.map((token) => {
    const surface = token.surface_form;
    const hasKanji = KANJI_REGEX.test(surface);
    const hasReading = token.reading && token.reading !== "*";
    const base = token.basic_form && token.basic_form !== "*" ? token.basic_form : surface;
    const isWord =
      CONTENT_POS.has(token.pos) &&
      JAPANESE_REGEX.test(surface) &&
      token.pos_detail_1 !== "数" &&
      token.pos_detail_1 !== "非自立" &&
      token.pos_detail_1 !== "接尾";

    let reading = null;
    if (hasKanji && hasReading) {
      const hira = katakanaToHiragana(token.reading);
      if (hira !== surface) reading = hira;
    }

    return { surface, reading, base, pos: token.pos, isWord, segments: furiganaSegments(surface, reading) };
  });
}
