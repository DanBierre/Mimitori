import { commonSet } from "../common.js";

// Which saved words are worth sending: not known, not already in Anki, not very common.
export function planBatch(words, state, common = commonSet()) {
  const send = [];
  const skip = [];
  for (const w of words) {
    const b = w.base;
    const skipIt =
      state.known?.[b] ||
      state.anki?.known?.[b] ||
      state.anki?.inDeck?.[b] ||
      (state.settings?.commonKnown !== false && common.has(b));
    (skipIt ? skip : send).push(w);
  }
  return { send, skip };
}

// The send wrapper both batch callers use: addCardFromWord, then markInAnki on success.
export const sendSaved = ({ anki, settings, markInAnki, add }) => async (word, maps) => {
  const result = await add({
    anki,
    settings,
    word: { base: word.base, surface: word.surface, reading: word.reading, glosses: word.glosses || [] },
    context: { sentence: word.sentence },
    maps,
  });
  if (result === "added" || result === "queued") markInAnki(word.base);
  return result;
};

// Sends one word at a time. `send(word, maps)` wraps addCardFromWord.
export async function sendBatch({ words, send, onStep, maps = { known: {}, inDeck: {} } }) {
  const out = { added: 0, queued: 0, skipped: 0, failed: 0, stopped: null };
  const live = { known: maps.known, inDeck: { ...maps.inDeck } };
  const seen = new Set();
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    onStep?.(i + 1, words.length, word);
    if (seen.has(word.base)) {
      out.skipped++;
      continue;
    }
    seen.add(word.base);
    const result = await send(word, live);
    if (result === "added" || result === "queued") {
      out[result]++;
      live.inDeck[word.base] = true;
    } else if (result === "duplicate") out.skipped++;
    else if (result === "changed") {
      out.stopped = "changed";
      break;
    } else out.failed++;
  }
  return out;
}
