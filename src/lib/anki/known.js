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

async function notesFor(anki, query, mapping) {
  const ids = await anki.invoke("findNotes", { query });
  const infos = [];
  for (let i = 0; i < ids.length; i += 500) {
    infos.push(...(await anki.invoke("notesInfo", { notes: ids.slice(i, i + 500) })));
  }
  const flat = (n) => Object.fromEntries(Object.entries(n.fields).map(([k, f]) => [k, f.value]));
  const byModel = {};
  for (const n of infos) (byModel[n.modelName] ||= []).push(n);
  const words = [];
  for (const [modelName, notes] of Object.entries(byModel)) {
    let map = mapping.model === modelName ? mapping.map : null;
    if (!map) {
      const names = Object.entries(notes[0].fields).sort((a, b) => a[1].order - b[1].order).map(([k]) => k);
      map = guessFieldRoles(names, notes.slice(0, 20).map(flat));
    }
    for (const n of notes) {
      const w = wordFromNote(flat(n), map);
      if (w) words.push(w);
    }
  }
  return words;
}

export async function fetchDeckWords(anki, { deck, model, mapping }) {
  const base = `"deck:${deck}"`;
  const m = { model, map: mapping };
  const all = await notesFor(anki, base, m);
  const mature = await notesFor(anki, `${base} prop:ivl>=21`, m);
  const known = Object.fromEntries(mature.map((w) => [w, true]));
  const inDeck = Object.fromEntries(all.filter((w) => !known[w]).map((w) => [w, true]));
  return { known, inDeck };
}
