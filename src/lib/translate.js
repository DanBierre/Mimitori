// translate.js
// Ported from the extension's background.js. Same Cloudflare Worker
// backend, same request shape — the only change is that this calls
// fetch() directly instead of going through chrome.runtime.sendMessage,
// since there's no extension messaging layer in a normal web app.

// TODO: replace with your deployed worker URL from `wrangler deploy`
// (same worker as the extension — see /worker in this project, ported
// unchanged from the extension's worker/ folder)
const BACKEND_URL = import.meta.env.VITE_TRANSLATE_WORKER_URL || "";

// Same text is never sent twice in a session (the free DeepL tier is limited).
const cache = new Map();

export async function translateText(text) {
  if (cache.has(text)) return cache.get(text);
  const translation = await requestTranslation(text);
  cache.set(text, translation);
  return translation;
}

async function requestTranslation(text) {
  if (!BACKEND_URL || BACKEND_URL.includes("your-worker-subdomain")) {
    throw new Error(
      "VITE_TRANSLATE_WORKER_URL not set — deploy the worker (see /worker/README) and add it to .env"
    );
  }

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
