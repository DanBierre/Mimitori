// Very common words (JMdict nf01-nf04), built by scripts/build-common.mjs.
// The app treats these as known unless settings.commonKnown is off.

let common = new Set();
let loaded = false;

export async function loadCommon(fetchImpl = fetch) {
  if (loaded) return;
  try {
    const res = await fetchImpl("/dict/common.json");
    const type = res.headers?.get("content-type") || "";
    if (!res.ok || type.includes("text/html")) return;
    common = new Set(await res.json());
    loaded = true; // only after a good load, so a failure can retry
  } catch {
    // leave the set empty; the next call tries again
  }
}

// Test-only: forget what was loaded.
export function resetCommon() {
  common = new Set();
  loaded = false;
}

export const commonSet = () => common;
export const isVeryCommon = (base) => common.has(base);
