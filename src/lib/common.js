// Very common words (JMdict nf01-nf04), built by scripts/build-common.mjs.
// The app treats these as known unless settings.commonKnown is off.

let common = new Set();
let loaded = false;

export async function loadCommon(fetchImpl = fetch) {
  if (loaded) return;
  loaded = true;
  try {
    const res = await fetchImpl("/dict/common.json");
    const type = res.headers?.get("content-type") || "";
    if (!res.ok || type.includes("text/html")) return;
    common = new Set(await res.json());
  } catch {
    // leave the set empty
  }
}

export const commonSet = () => common;
export const isVeryCommon = (base) => common.has(base);
