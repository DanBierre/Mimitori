// translate.js
// Ported from the extension's background.js. Same Cloudflare Worker
// backend, same request shape — the only change is that this calls
// fetch() directly instead of going through chrome.runtime.sendMessage,
// since there's no extension messaging layer in a normal web app.

// Optional. Set VITE_TRANSLATE_WORKER_URL to your own deployed worker (see
// /worker). Without it the app hides translation and everything else works.
const BACKEND_URL = import.meta.env.VITE_TRANSLATE_WORKER_URL || "";

export const translationEnabled = Boolean(BACKEND_URL) && !BACKEND_URL.includes("your-worker-subdomain");

// Same text is never sent twice in a session (the free DeepL tier is limited).
const cache = new Map();

export async function translateText(text) {
  if (cache.has(text)) return cache.get(text);
  const translation = await requestTranslation(text);
  cache.set(text, translation);
  return translation;
}

async function requestTranslation(text) {
  if (!translationEnabled) throw new Error("Translation isn't set up.");

  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Translation request failed: ${errText}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  return data.translation;
}
