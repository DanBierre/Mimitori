import { furiganaSegments } from "../furigana.js";

export function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Anki bracket syntax: base text runs back to the previous space, so every
// ruby segment after the first gets a leading space.
export function toBracketFurigana(segments) {
  return segments
    .map((s, i) => (s.ruby ? `${i ? " " : ""}${s.text}[${s.ruby}]` : s.text))
    .join("");
}

export function wordFurigana(base, reading) {
  return toBracketFurigana(furiganaSegments(base, reading));
}

export function sentenceWithFurigana(tokens, highlight) {
  return tokens
    .map((t, i) => {
      const out = toBracketFurigana(
        t.segments.map((s) => ({ ...s, text: escapeHtml(s.text) })),
      );
      return i === highlight ? `<b>${out}</b>` : out;
    })
    .join("");
}

export function boldWord(sentence, surface) {
  const s = escapeHtml(sentence);
  const w = escapeHtml(surface);
  const i = w ? s.indexOf(w) : -1;
  return i < 0 ? s : `${s.slice(0, i)}<b>${w}</b>${s.slice(i + w.length)}`;
}

export function formatMeaning(glosses, format) {
  const g = glosses.map(escapeHtml);
  return format === "list"
    ? `<ol>${g.map((x) => `<li>${x}</li>`).join("")}</ol>`
    : g.join("; ");
}

export function formatSource(fileName, ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  const time = h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  return `${fileName} · ${time}`;
}
