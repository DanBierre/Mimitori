// levels.js
// JLPT level, and whether JMdict marks the word as common, built by scripts/build-levels.mjs.
// Loaded once, only when Words opens.

let table = null;
let pending = null;

export function parseLevels({ jlpt = {}, common = [] } = {}) {
  const map = new Map();
  for (const [level, forms] of Object.entries(jlpt)) for (const f of forms) map.set(f, { jlpt: Number(level), common: false });
  for (const f of common) map.set(f, { jlpt: map.get(f)?.jlpt || 0, common: true });
  return map;
}

export function loadLevels(fetchImpl = fetch) {
  if (table) return Promise.resolve(table);
  pending ||= fetchImpl("/dict/levels.json")
    .then((res) => (res.ok && !(res.headers?.get("content-type") || "").includes("text/html") ? res.json() : null))
    .then((data) => (table = parseLevels(data || {})))
    .catch(() => {
      pending = null; // offline: try again next time Words opens
      return new Map();
    });
  return pending;
}

// "N5 · common", "N2", "common" or "".
export function levelTag(info, t = (s) => s) {
  if (!info) return "";
  return [info.jlpt && `N${info.jlpt}`, info.common && t("common")].filter(Boolean).join(" · ");
}
