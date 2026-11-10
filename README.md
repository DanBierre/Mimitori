# Nihongo Reader

Cross-platform Japanese reading-assist app (iOS + Android via Capacitor),
built from the same core as the original "Japanese Text Highlighter"
Chrome extension: local furigana generation (kuromoji.js) + translation
via a Cloudflare Worker backend holding the DeepL key.

## What's ported from the extension, unchanged

- `public/kuromoji.js` + `public/dict/` — the tokenizer and dictionary
  data, byte-for-byte from the extension's `lib/` and `dict/`.
- `worker/` — the Cloudflare Worker backend, copied as-is. Same
  deployment steps apply (see `worker/wrangler.toml`).
- `src/lib/furigana.js` — the extension's `buildFurigana()` logic,
  ported to return structured token data instead of an HTML string
  (so React can render it as real `<ruby>` elements).
- `src/lib/translate.js` — the extension's translation-request logic,
  now a direct `fetch()` instead of a `chrome.runtime.sendMessage` call.

## What's new

- `src/components/ReaderView.jsx` — the actual reading UI: paste box,
  tokenized reading display, translation, per-word "save to Anki" chips.
- `src/lib/ankiExport.js` — sends a looked-up word to Anki:
  - **iOS**: uses AnkiMobile's `x-callback-url` scheme directly — no
    native code needed, works from the web view as-is.
  - **Android**: currently a stub. AnkiDroid's Instant-Add API needs
    actual native code (it's a permissioned local API, not callable
    from JS directly), so this needs a small Capacitor plugin before
    it'll work. See the comment in the file for what's needed next.

## Setup

```bash
npm install
cp .env.example .env   # then fill in your deployed worker URL
npm run dev             # runs as a normal web app in the browser first
```

To build and run as an actual iOS/Android app:

```bash
npm run build
npx cap add ios       # first time only
npx cap add android   # first time only
npm run cap:sync
npm run cap:ios       # opens Xcode
npm run cap:android   # opens Android Studio
```

## Deploying the translation backend

The worker is unchanged from the extension — same steps as before:
deploy with `wrangler deploy` from inside `/worker`, then put the
resulting URL into `.env` as `VITE_TRANSLATE_WORKER_URL`.

## Next steps (not built yet)

- Android Anki export (the Capacitor plugin mentioned above)
- Vocab deck / review screen (currently every "save" just fires off
  to Anki directly — no local history or SRS review inside the app itself)
- Per-word dictionary meanings (right now the translation is
  sentence-level only, from DeepL — word-level definitions would need
  a proper dictionary lookup, e.g. JMdict, alongside kuromoji's tokens)
- Reading history
- OCR/camera input, for text that can't be pasted (e.g. game screenshots)
