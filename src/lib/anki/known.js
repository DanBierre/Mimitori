import { JAPANESE_REGEX } from "../furigana.js";
import { guessFieldRoles } from "./fieldRoles.js";

export const cleanExpression = (v) =>
  v
    .replace(/\[sound:[^\]]*\]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, "");

const valid = (w) => w.length > 0 && w.length <= 12 && JAPANESE_REGEX.test(w) && !/[A-Za-z=()<>\[\]]/.test(w);

const entries = (mapping, role) => Object.entries(mapping).filter(([, m]) => m.role === role);

export function wordFromNote(fields, mapping) {
  for (const [name] of entries(mapping, "expression")) {
    const w = cleanExpression(fields[name] ?? "");
    if (w) return w;
  }
  for (const [name, m] of entries(mapping, "template")) {
    if (!(m.template ?? "").includes("{expression}")) continue;
    const text = (fields[name] ?? "").normalize("NFKC");
    const cut = text.search(/\(|=|<br\s*\/?>/i);
    const w = cleanExpression(cut >= 0 ? text.slice(0, cut) : text);
    if (valid(w)) return w;
  }
  for (const [name] of entries(mapping, "sentence")) {
    const bold = [...(fields[name] ?? "").matchAll(/<b>(.*?)<\/b>/gis)].map((x) => x[1]).join("");
    const w = cleanExpression(bold);
    if (w) return w;
  }
  return "";
}

export async function fetchDeckWords(anki, { deck, model, mapping }) {
  const base = `"deck:${deck}"`;
  const ids = await anki.invoke("findNotes", { query: base });
  const matureIds = new Set(await anki.invoke("findNotes", { query: `${base} prop:ivl>=21` }));
  const infos = [];
  for (let i = 0; i < ids.length; i += 500) {
    infos.push(...(await anki.invoke("notesInfo", { notes: ids.slice(i, i + 500) })));
  }
  const flat = (n) => Object.fromEntries(Object.entries(n.fields).map(([k, f]) => [k, f.value]));
  const byModel = {};
  for (const n of infos) (byModel[n.modelName] ||= []).push(n);
  const known = {};
  const inDeck = {};
  for (const [modelName, notes] of Object.entries(byModel)) {
    let map = modelName === model ? mapping : null;
    if (!map) {
      // guessed once per model from the whole deck, so mature and other notes share it
      const names = Object.entries(notes[0].fields).sort((a, b) => a[1].order - b[1].order).map(([k]) => k);
      map = guessFieldRoles(names, notes.slice(0, 20).map(flat));
    }
    for (const n of notes) {
      const w = wordFromNote(flat(n), map);
      if (w) (matureIds.has(n.noteId) ? known : inDeck)[w] = true;
    }
  }
  for (const w of Object.keys(known)) delete inDeck[w];
  return { known, inDeck };
}
