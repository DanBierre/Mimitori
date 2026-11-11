// Sentence containing token i, from the token stream so it matches the sheet.
// end is inclusive.
export function sentenceSpan(tokens, i) {
  const isEnd = (t) => /[。！？!?\n]/.test(t.surface);
  let start = i;
  while (start > 0 && !isEnd(tokens[start - 1])) start--;
  let end = i;
  while (end < tokens.length - 1 && !isEnd(tokens[end])) end++;
  return { start, end };
}

export function sentenceAround(tokens, i) {
  const { start, end } = sentenceSpan(tokens, i);
  return tokens.slice(start, end + 1).map((t) => t.surface).join("").trim();
}

// What the word card needs to build an Anki sentence: the sentence, its tokens, and where the tapped word sits in them.
export function sentenceContext(tokens, i) {
  const { start, end } = sentenceSpan(tokens, i);
  return { sentence: sentenceAround(tokens, i), tokens: tokens.slice(start, end + 1), tokenIndex: i - start };
}
