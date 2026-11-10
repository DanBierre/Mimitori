export const cleanExpression = (v) =>
  v
    .replace(/\[sound:[^\]]*\]/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, "");

const entries = (mapping, role) => Object.entries(mapping).filter(([, m]) => m.role === role);

export function wordFromNote(fields, mapping) {
  for (const [name] of entries(mapping, "expression")) {
    const w = cleanExpression(fields[name] ?? "");
    if (w) return w;
  }
  for (const [name, m] of entries(mapping, "template")) {
    const after = (m.template ?? "").split("{expression}")[1];
    if (after === undefined) continue;
    // glue = literal text right after {expression}, up to the next slot
    const glue = after.split("{")[0].trim();
    let text = fields[name] ?? "";
    if (glue) {
      const first = glue[0];
      const cuts = (first === "（" || first === "(" ? ["（", "("] : [first])
        .map((c) => text.indexOf(c)).filter((i) => i >= 0);
      if (!cuts.length) continue; // field does not match the template
      text = text.slice(0, Math.min(...cuts));
    } else {
      text = text.split(/<br\s*\/?>/i)[0];
    }
    const w = cleanExpression(text);
    if (w) return w;
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
  const words = [];
  for (let i = 0; i < ids.length; i += 500) {
    const infos = await anki.invoke("notesInfo", { notes: ids.slice(i, i + 500) });
    for (const n of infos) {
      const fields = Object.fromEntries(Object.entries(n.fields).map(([k, f]) => [k, f.value]));
      const w = wordFromNote(fields, mapping);
      if (w) words.push(w);
    }
  }
  return words;
}

export async function fetchDeckWords(anki, { deck, model, mapping }) {
  const base = `"deck:${deck}" "note:${model}"`;
  const all = await notesFor(anki, base, mapping);
  const mature = await notesFor(anki, `${base} prop:ivl>=21`, mapping);
  const known = Object.fromEntries(mature.map((w) => [w, true]));
  const inDeck = Object.fromEntries(all.filter((w) => !known[w]).map((w) => [w, true]));
  return { known, inDeck };
}
