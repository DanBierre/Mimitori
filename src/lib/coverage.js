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
