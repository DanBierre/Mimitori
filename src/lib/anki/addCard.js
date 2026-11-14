// addCard.js
// Adds one word to the learner's Anki deck. The decision logic takes its
// dependencies as arguments so it can be unit-tested with fakes.

import { buildNote } from "./buildNote.js";
import { fieldListChanged } from "./fieldRoles.js";
import { recordLine } from "../media/clip.js";
import { captureFrame } from "../images.js";
import { enqueue, listQueue } from "./queue.js";
import { deckQuery } from "./known.js";

// Blob -> base64 without the "data:" prefix (what AnkiConnect wants).
export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// Does the mapping want this kind of media, in its own field or inside a layout?
const wantsMedia = (mapping, role, slot) =>
  Object.values(mapping).some((e) => e.role === role || (e.role === "template" && e.template?.includes(`{${slot}}`)));

const esc = (s) => s.replace(/[\\"*_:]/g, "\\$&");

// The Anki search that finds `base` in one mapped field, or null when the field can't hold the word.
// An expression field must equal the word. A template field must hold it with the template's own
// text around it: "{expression}（{reading}）＝…" gives "Back:検証（*", so 検証済み doesn't count.
export function wordQuery(field, m, base) {
  if (m.role === "expression") return `"${field}:${esc(base)}"`;
  if (m.role !== "template" || !m.template?.includes("{expression}")) return null;
  const slot = /\{\w+\}/;
  const [before, after] = m.template.split("{expression}");
  const head = slot.test(before) ? `*${esc(before.split(slot).at(-1))}` : esc(before);
  const tail = esc(after.split(slot)[0]);
  return `"${field}:${head}${esc(base)}${tail}${slot.test(after) ? "*" : ""}"`;
}

const realDeps = { recordLine, captureFrame, enqueue, listQueue, now: () => Date.now() };

// Returns "added" | "duplicate" | "queued" | "changed" | { error }.
// maps: { known, inDeck } from state.anki. Audio failure still adds the card
// (onProgress("noAudio")).
export async function addCardFromWord({
  anki,
  settings,
  word,
  context = {},
  video,
  cue,
  picture,
  offsetMs = 0,
  maps = {},
  onProgress = () => {},
  deps = {},
}) {
  const d = { ...realDeps, ...deps };
  const { deck, model, mapping, fieldList } = settings;
  try {
    let reachable = true;
    try {
      const names = await anki.invoke("modelFieldNames", { modelName: model });
      if (fieldListChanged(fieldList, names)) return "changed";
    } catch (e) {
      if (e?.kind !== "unreachable") throw e;
      reachable = false;
    }

    if (maps.known?.[word.base] || maps.inDeck?.[word.base]) return "duplicate";

    // One card per word: a queued card or a note with this word already counts.
    if (!reachable) {
      if ((await d.listQueue().catch(() => [])).some((q) => q.base === word.base)) return "duplicate";
    } else {
      for (const [field, m] of Object.entries(mapping)) {
        const q = wordQuery(field, m, word.base);
        if (!q) continue;
        // Anki dropping out here is fine: addNote below queues the card.
        const hit = await anki.invoke("findNotes", { query: `${deckQuery(deck)} ${q}` }).catch((e) => {
          if (e?.kind !== "unreachable") throw e;
        });
        if (Array.isArray(hit) && hit.length) return "duplicate";
      }
    }

    const media = {};
    if ((picture || video) && wantsMedia(mapping, "picture", "picture")) {
      const blob = picture || (await d.captureFrame(video));
      if (blob) media.picture = { data: await blobToBase64(blob), ext: "jpg" };
    }
    if (video && cue && wantsMedia(mapping, "sentenceAudio", "sentenceAudio")) {
      onProgress("recording");
      let blob = null;
      try {
        blob = await d.recordLine(video, cue.start + offsetMs, cue.end + offsetMs);
      } catch {
        blob = null;
      }
      if (blob) media.audio = { data: await blobToBase64(blob), ext: "webm" };
      else onProgress("noAudio");
    }

    const full = buildNote({ deck, model, mapping, word, context: { ...context, now: d.now() }, media });
    if (!reachable) {
      await d.enqueue(full, { fieldList, base: word.base });
      return "queued";
    }

    const { storeMedia = [], ...note } = full;
    try {
      for (const m of storeMedia) await anki.invoke("storeMediaFile", { filename: m.filename, data: m.data });
      await anki.invoke("addNote", { note });
      return "added";
    } catch (e) {
      if (e?.kind === "unreachable") {
        await d.enqueue(full, { fieldList, base: word.base });
        return "queued";
      }
      if (/duplicate/i.test(e?.message || "")) return "duplicate";
      throw e;
    }
  } catch (e) {
    return { error: e?.message || "Something went wrong adding the card." };
  }
}
