// addCard.js
// Adds one word to the learner's Anki deck. The decision logic takes its
// dependencies as arguments so it can be unit-tested with fakes.

import { buildNote } from "./buildNote.js";
import { fieldListChanged } from "./fieldRoles.js";
import { recordLine } from "../media/clip.js";
import { captureFrame } from "../images.js";
import { enqueue } from "./queue.js";

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

const realDeps = { recordLine, captureFrame, enqueue, now: () => Date.now() };

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

    const media = {};
    if (video && wantsMedia(mapping, "picture", "picture")) {
      const blob = await d.captureFrame(video);
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
      await d.enqueue(full);
      return "queued";
    }

    const { storeMedia = [], ...note } = full;
    try {
      for (const m of storeMedia) await anki.invoke("storeMediaFile", { filename: m.filename, data: m.data });
      await anki.invoke("addNote", { note });
      return "added";
    } catch (e) {
      if (e?.kind === "unreachable") {
        await d.enqueue(full);
        return "queued";
      }
      if (/duplicate/i.test(e?.message || "")) return "duplicate";
      throw e;
    }
  } catch (e) {
    return { error: e?.message || "Something went wrong adding the card." };
  }
}
