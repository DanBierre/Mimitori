// write.js
// Cues + a timing offset -> an .srt file. Lines pushed entirely before 0 are
// dropped; a line that straddles 0 starts at 0.

const pad = (n, w = 2) => String(n).padStart(w, "0");

function stamp(t) {
  const h = Math.floor(t / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(t % 1000, 3)}`;
}

export function writeSrt(cues, offsetMs) {
  return cues
    .map((c) => ({ start: Math.round(c.start + offsetMs), end: Math.round(c.end + offsetMs), text: c.text }))
    .filter((c) => c.end > 0)
    .map((c, i) => `${i + 1}\n${stamp(Math.max(0, c.start))} --> ${stamp(c.end)}\n${c.text}\n`)
    .join("\n");
}
