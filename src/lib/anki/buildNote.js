import { escapeHtml, wordFurigana, sentenceWithFurigana, boldWord, formatMeaning, formatSource } from "./format.js";

// Character offset of token `index` within the sentence (undefined if unknown).
const tokenOffset = (tokens, index) =>
  tokens && Number.isInteger(index) ? tokens.slice(0, index).reduce((n, t) => n + (t.surface?.length ?? 0), 0) : undefined;

export function buildNote({ deck, model, mapping, word, context = {}, media = {} }) {
  const now = context.now ?? Date.now();
  const files = {};
  for (const kind of ["picture", "audio"]) {
    if (media[kind]) files[kind] = { ...media[kind], filename: `mimitori-${word.base}-${now}.${media[kind].ext}` };
  }
  const entries = Object.entries(mapping);
  const inTemplate = (slot) => entries.some(([, e]) => e.role === "template" && e.template?.includes(slot));
  const storeMedia = [];
  const stored = new Set();
  const store = (kind) => {
    if (!stored.has(kind)) { stored.add(kind); storeMedia.push({ filename: files[kind].filename, data: files[kind].data }); }
  };
  const meaning = (e) => formatMeaning(word.glosses, e.format);

  function fillTemplate(e) {
    const slots = {
      expression: escapeHtml(word.base),
      reading: escapeHtml(word.reading),
      meaning: meaning(e),
      sentenceAudio: "",
      picture: "",
    };
    if (files.audio) { store("audio"); slots.sentenceAudio = `[sound:${files.audio.filename}]`; }
    if (files.picture) { store("picture"); slots.picture = `<img src="${files.picture.filename}">`; }
    return e.template.replace(/\{(\w+)\}/g, (m, k) => slots[k] ?? m).replace(/(<br\s*\/?>)+$/i, "").replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>");
  }

  const fields = {};
  const note = {
    deckName: deck,
    modelName: model,
    fields,
    tags: ["mimitori"],
    options: { allowDuplicate: false, duplicateScope: "deck" },
    storeMedia,
  };
  const attach = (kind, field) => {
    (note[kind] ||= []).push({ data: files[kind].data, filename: files[kind].filename, fields: [field] });
  };

  for (const [field, e] of entries) {
    const { sentence, tokens, tokenIndex, translation, fileName, timeMs } = context;
    let v = "";
    switch (e.role) {
      case "template": v = fillTemplate(e); break;
      case "expression": v = escapeHtml(word.base); break;
      case "reading": v = e.format === "bracket" ? wordFurigana(word.base, word.reading) : escapeHtml(word.reading); break;
      case "meaning": v = meaning(e); break;
      case "sentence": v = sentence ? boldWord(sentence, word.surface, tokenOffset(tokens, tokenIndex)) : ""; break;
      case "sentenceFurigana": v = tokens ? sentenceWithFurigana(tokens, tokenIndex) : ""; break;
      case "sentenceTranslation": v = translation ? escapeHtml(translation) : ""; break;
      case "source": v = fileName ? formatSource(fileName, timeMs ?? 0) : ""; break;
      case "picture": if (files.picture && !inTemplate("{picture}")) attach("picture", field); break;
      case "sentenceAudio": if (files.audio && !inTemplate("{sentenceAudio}")) attach("audio", field); break;
    }
    fields[field] = v;
  }
  return note;
}
