// Share of words already known across some tokenized lines, as a whole percent, or null with no words.
export function coverageOf(tokenLines, isKnown) {
  let all = 0;
  let known = 0;
  for (const line of tokenLines) {
    for (const t of line || []) {
      if (!t.isWord) continue;
      all++;
      if (isKnown(t.base)) known++;
    }
  }
  return all ? Math.round((known / all) * 100) : null;
}

// Different not-yet-known words in one line (a word said twice counts once).
export function newCount(tokens, isKnown) {
  const fresh = new Set();
  for (const t of tokens || []) if (t.isWord && !isKnown(t.base)) fresh.add(t.base);
  return fresh.size;
}

// One new word in an otherwise known sentence is the easiest kind to learn from.
// Returns the token indexes of such lone new words. Sentences end at 。！？!? or a line break.
export function loneNewWords(tokens, isKnown) {
  const out = new Set();
  let start = 0;
  const flush = (end) => {
    const fresh = new Set();
    for (let i = start; i < end; i++) if (tokens[i].isWord && !isKnown(tokens[i].base)) fresh.add(tokens[i].base);
    if (fresh.size === 1) for (let i = start; i < end; i++) if (tokens[i].isWord && fresh.has(tokens[i].base)) out.add(i);
    start = end;
  };
  (tokens || []).forEach((t, i) => !t.isWord && /[。！？!?\n]/.test(t.surface) && flush(i + 1));
  if (tokens) flush(tokens.length);
  return out;
}
