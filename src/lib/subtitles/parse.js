// parse.js
// SRT, WebVTT and ASS/SSA -> { cues: [{ start, end, text }], skipped }.
// Times are milliseconds. Styling is stripped; line breaks are kept as "\n".
// `skipped` counts blocks with broken timing, not lines that were empty.

const SRT_TIME = /(\d+):(\d{2}):(\d{2})[,.](\d{3})/;
const VTT_TIME = /(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})/;
const ASS_TIME = /^(\d+):(\d{2}):(\d{2})\.(\d{2})$/;

function ms(h, m, s, frac) {
  return ((Number(h || 0) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(frac);
}

function detectFormat(text, fileName) {
  const ext = (fileName.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  if (ext === "srt" || ext === "vtt") return ext;
  if (ext === "ass" || ext === "ssa") return "ass";
  if (/^WEBVTT/.test(text)) return "vtt";
  if (/^\[(Script Info|Events)\]/m.test(text)) return "ass";
  return "srt";
}

const stripTags = (s) => s.replace(/<[^>]+>/g, "");

// SRT and VTT share the block shape: optional id line, a "-->" line, text lines.
function parseBlocks(text, timeRe) {
  const cues = [];
  let skipped = 0;
  for (const block of text.split(/\n[ \t]*\n(?:[ \t]*\n)*/)) {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at === -1) continue; // header, NOTE, STYLE, stray numbers
    const [left, right] = lines[at].split("-->");
    const a = left.trim().match(new RegExp("^" + timeRe.source + "$"));
    const b = right.trim().split(/\s+/)[0].match(new RegExp("^" + timeRe.source + "$"));
    if (!a || !b) {
      skipped++;
      continue;
    }
    const start = ms(a[1], a[2], a[3], a[4]);
    const end = ms(b[1], b[2], b[3], b[4]);
    if (end <= start) {
      skipped++;
      continue;
    }
    const body = stripTags(lines.slice(at + 1).join("\n")).trim();
    if (body) cues.push({ start, end, text: body });
  }
  return { cues, skipped };
}

function parseAss(text) {
  const cues = [];
  let skipped = 0;
  let inEvents = false;
  let cols = null;
  for (const line of text.split("\n")) {
    const section = line.match(/^\[(.+)\]\s*$/);
    if (section) {
      inEvents = section[1].toLowerCase() === "events";
      continue;
    }
    if (!inEvents) continue;
    if (line.startsWith("Format:")) {
      cols = line.slice(7).split(",").map((c) => c.trim().toLowerCase());
      continue;
    }
    if (!line.startsWith("Dialogue:") || !cols) continue;
    const parts = line.slice(9).split(",");
    const fields = parts.slice(0, cols.length - 1).concat(parts.slice(cols.length - 1).join(","));
    const get = (name) => (fields[cols.indexOf(name)] || "").trim();
    const raw = fields[cols.indexOf("text")] ?? "";
    if (/\{[^}]*\\p[1-9]/.test(raw)) continue; // vector drawing, not dialogue
    const a = get("start").match(ASS_TIME);
    const b = get("end").match(ASS_TIME);
    if (!a || !b) {
      skipped++;
      continue;
    }
    const start = ms(a[1], a[2], a[3], Number(a[4]) * 10);
    const end = ms(b[1], b[2], b[3], Number(b[4]) * 10);
    if (end <= start) {
      skipped++;
      continue;
    }
    const body = raw
      .replace(/\{[^}]*\}/g, "")
      .replace(/\\[Nn]/g, "\n")
      .replace(/\\h/g, " ")
      .trim();
    if (body) cues.push({ start, end, text: body });
  }
  return { cues, skipped };
}

export function parseSubtitles(text, fileName = "") {
  const clean = text.replace(/\r\n?/g, "\n");
  const format = detectFormat(clean, fileName);
  const result =
    format === "ass" ? parseAss(clean) : parseBlocks(clean, format === "vtt" ? VTT_TIME : SRT_TIME);
  result.cues.sort((x, y) => x.start - y.start);
  return result;
}
