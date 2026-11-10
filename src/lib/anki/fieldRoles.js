import { JAPANESE_REGEX } from "../furigana.js";

export const ROLES = ["expression", "reading", "meaning", "sentence", "sentenceFurigana", "sentenceTranslation", "picture", "sentenceAudio", "source"];

const STRONG = 0.6;
const KANA = "ぁ-ゖァ-ヺー";
const KANJI_REGEX = /[一-龯々]/;
const BRACKET_REGEX = /[一-龯々]\[[ぁ-ゖー]+\]/;
const KANA_ONLY_REGEX = new RegExp(`^[${KANA}・\\s]+$`);
const SENTENCE_END_REGEX = /[。！？!?]$/;

// ---- Name signal ----------------------------------------------------------

const NAMES = {
  expression: ["Expression", "Word", "Vocab", "Term", "Front", "Key", "単語", "語"],
  reading: ["Reading", "ExpressionReading", "Kana", "Furigana", "ExpressionFurigana", "読み"],
  meaning: ["Meaning", "Definition", "Glossary", "MainDefinition", "Back", "English", "意味"],
  sentence: ["Sentence", "Example", "Context", "例文"],
  sentenceFurigana: ["SentenceFurigana", "SentenceReading"],
  sentenceTranslation: ["SentenceTranslation", "SentenceMeaning", "SentenceEng", "Translation"],
  picture: ["Picture", "Image", "Screenshot", "Snapshot", "画像"],
  sentenceAudio: ["SentenceAudio", "Audio", "Sound", "音声"], // WordAudio / ExpressionAudio are not listed, so never match
  source: ["Source", "MiscInfo", "Notes"],
};

const normName = (s) => s.toLowerCase().replace(/[\s_-]/g, "");

const NAME_SCORES = Object.entries(NAMES).flatMap(([role, list]) =>
  list.map((n, i) => ({ key: normName(n), role, score: 0.7 - 0.01 * i })));

function nameSignal(fieldName) {
  const key = normName(fieldName);
  const hit = NAME_SCORES.find((n) => n.key === key);
  return hit ? { role: hit.role, confidence: hit.score } : null;
}

// ---- Content classifier ---------------------------------------------------

const stripHtml = (v) => v.replace(/\[sound:[^\]]*\]/g, "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

function classify(value, fieldName) {
  if (/\[sound:/.test(value)) return { role: "sentenceAudio" };
  if (/<img/i.test(value)) return { role: "picture" };
  const text = stripHtml(value);
  if (BRACKET_REGEX.test(text)) return { role: text.length > 10 ? "sentenceFurigana" : "reading", format: "bracket" };
  if (KANA_ONLY_REGEX.test(text)) return { role: "reading", format: "kana" };
  if (JAPANESE_REGEX.test(text)) {
    const partlyBold = /<b>/i.test(value) && stripHtml(value.replace(/<b>[^<]*<\/b>/gi, "")) !== "";
    if (partlyBold || SENTENCE_END_REGEX.test(text) || text.length > 10) return { role: "sentence" };
    if (KANJI_REGEX.test(text) && !/\s/.test(text)) return { role: "expression" };
    return null;
  }
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  if (letters && letters / text.replace(/\s/g, "").length > 0.5) {
    return { role: /sentence|translation/.test(normName(fieldName)) ? "sentenceTranslation" : "meaning" };
  }
  return null;
}

// The class that covers >= 60% of non-empty samples, if any.
function contentSignal(fieldName, values) {
  if (!values.length) return null;
  const counts = {};
  for (const v of values) {
    const c = classify(v, fieldName);
    if (c) (counts[c.role] ||= { n: 0, brackets: 0 }).n++, (c.format === "bracket" && counts[c.role].brackets++);
  }
  const [role, c] = Object.entries(counts).sort((a, b) => b[1].n - a[1].n)[0] || [];
  if (!role || c.n / values.length < STRONG) return null;
  return { role, format: c.brackets > c.n / 2 ? "bracket" : "kana" };
}

// ---- Template detection (word + reading + meaning combined in one field) ---

function boldedWord(sentenceValue) {
  const run = sentenceValue.match(/(?:<b>[^<]*<\/b>)+/i);
  return run ? stripHtml(run[0]) : "";
}

// Longest run of Latin text outside {placeholders} and HTML tags -> {meaning}.
function replaceLongestLatin(str) {
  const parts = str.split(/(\{[A-Za-z]+\}|<[^>]*>)/);
  let best = null;
  parts.forEach((p, i) => {
    if (i % 2) return;
    for (const m of p.matchAll(/[A-Za-z][A-Za-z ;,.'()-]*/g)) {
      const text = m[0].trimEnd();
      if (!best || text.length > best.text.length) best = { i, at: m.index, text };
    }
  });
  if (!best) return str;
  parts[best.i] = parts[best.i].slice(0, best.at) + "{meaning}" + parts[best.i].slice(best.at + best.text.length);
  return parts.join("");
}

function buildTemplate(raw, word) {
  const value = raw.replace(/\[sound:[^\]]*\]/g, "{sentenceAudio}").replace(/<img[^>]*>/gi, "{picture}");
  const at = word ? value.indexOf(word) : -1;
  if (at < 0) return null;
  const head = value.slice(0, at) + "{expression}";
  let tail = value.slice(at + word.length);
  tail = tail.replace(new RegExp(`[${KANA}]+`), "{reading}");
  return replaceLongestLatin(head + tail);
}

const squash = (t) => t.normalize("NFKC").replace(/[\s​-‍﻿]/g, "");

// Pairs each sample's word with that sample's value of the field (by sample index).
// Agreement is judged ignoring whitespace; the output is the most common exact variant.
function templateSignal(samples, field, words) {
  const groups = new Map();
  let total = 0;
  samples.forEach((s, i) => {
    if (!isFilled(s[field])) return;
    total++;
    const t = words[i] && buildTemplate(s[field], words[i]);
    if (!t) return;
    const g = groups.get(squash(t)) || new Map();
    g.set(t, (g.get(t) || 0) + 1);
    groups.set(squash(t), g);
  });
  const size = (g) => [...g.values()].reduce((a, b) => a + b, 0);
  const best = [...groups.values()].sort((a, b) => size(b) - size(a))[0];
  if (!best || size(best) / total < STRONG) return null;
  const template = [...best].sort((a, b) => b[1] - a[1])[0][0];
  return template.includes("{expression}") && /\{(reading|meaning)\}/.test(template) ? template : null;
}

// ---- Assignment -----------------------------------------------------------

const isFilled = (v) => typeof v === "string" && (stripHtml(v) !== "" || /<img|\[sound:/.test(v));
const nonEmpty = (samples, f) => samples.map((s) => s[f]).filter(isFilled);

function sampleText(values) {
  return values.length ? stripHtml(values[0]).slice(0, 40) : "";
}

export function guessFieldRoles(fieldNames, samples) {
  const values = Object.fromEntries(fieldNames.map((f) => [f, nonEmpty(samples, f)]));
  const content = Object.fromEntries(fieldNames.map((f) => [f, contentSignal(f, values[f])]));

  // Word per sample comes from the bolded text in the first sentence-like field.
  const sentenceField = fieldNames.find((f) => content[f]?.role === "sentence" && values[f].some((v) => /<b>/i.test(v)));
  const words = sentenceField ? samples.map((s) => boldedWord(s[sentenceField] || "")) : [];

  const out = {};
  const candidates = [];
  const claimed = new Set(); // roles used as slots in a template field
  for (const f of fieldNames) {
    out[f] = { role: null, confidence: 0, format: null, sample: sampleText(values[f]), from: null };
    const template = sentenceField && f !== sentenceField && words.some(Boolean) ? templateSignal(samples, f, words) : null;
    if (template) {
      const list = values[f].some((v) => v.includes("<li>"));
      for (const m of template.matchAll(/\{(\w+)\}/g)) claimed.add(m[1]);
      out[f] = { ...out[f], role: "template", template, confidence: 0.9, format: list ? "list" : "plain", from: "content" };
      continue;
    }
    const byName = nameSignal(f);
    const byContent = content[f];
    const audioName = ["wordaudio", "expressionaudio"].includes(normName(f));
    if (byContent && !(audioName && byContent.role === "sentenceAudio")) {
      const agrees = byName?.role === byContent.role;
      candidates.push({ f, role: byContent.role, confidence: agrees ? 1 : 0.9, from: "content", readingFormat: byContent.format });
    } else if (byName && !byContent) {
      candidates.push({ f, role: byName.role, confidence: byName.confidence, from: "name" });
    }
  }

  const taken = new Set();
  for (const c of candidates.sort((a, b) => b.confidence - a.confidence)) {
    if (taken.has(c.role) || (c.from === "name" && claimed.has(c.role))) continue;
    taken.add(c.role);
    const format = c.role === "reading" ? c.readingFormat || "kana"
      : c.role === "meaning" ? (values[c.f].some((v) => v.includes("<li>")) ? "list" : "plain")
      : null;
    Object.assign(out[c.f], { role: c.role, confidence: c.confidence, format, from: c.from });
  }
  return out;
}

export function fieldListChanged(saved, current) {
  return saved.length !== current.length || saved.some((f, i) => f !== current[i]);
}
