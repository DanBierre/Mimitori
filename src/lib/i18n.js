import ja from "./ja/index.js";

// Review intervals ("10m", "3d", "2mo") come from srs.formatInterval; Japanese gets 分, 日, か月.
const UNITS = { m: "分", h: "時間", d: "日", mo: "か月", y: "年" };

// The interface speaks English or Japanese. Strings are keyed by their English text,
// so a missing translation just shows the English. {name} slots fill from vars.
export function translate(lang, text, vars) {
  let out = text;
  if (lang === "ja") {
    const span = /^(\d+(?:\.\d)?)(mo|m|h|d|y)$/.exec(text);
    out = ja[text] ?? (span ? span[1] + UNITS[span[2]] : text);
  }
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)) : out;
}
