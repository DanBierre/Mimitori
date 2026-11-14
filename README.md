<img src="brand/mark.svg" width="72" height="72" alt="" />

# Mimitori

A free, open source study app for Japanese learners. Read manga, PDFs and plain text, or watch your own videos with Japanese subtitles. Tap any word for its reading and meaning, save it, and review it later. No account, no setup, and your files never leave your computer.

![The Read tab: a short Japanese passage with furigana, and the word card for 風景 open](docs/screenshot.jpg)

## What it does

- **Read manga and PDFs:** open a `.cbz`, `.zip`, PDF or a folder of pages. Drop it on the page or pick it. Draw a box around a speech bubble and Mimitori reads the text out of it, right on your computer. The reader is a one-off 117 MB download. PDFs with real text skip that step. Your recent books remember the page you got to.
- **Read text:** paste Japanese and get furigana over the kanji. Tap a word for its meaning and save it. Not sure what to read? There are 50 short samples to try.
- **Watch:** drop in a video and its subtitle file (`.srt`, `.vtt` or `.ass`). The current line shows with furigana and tappable words. You can replay a line, pause after each one, slow things down, and fix subtitles that are out of sync.
- **Make subtitles:** if a video has no subtitle file, the Watch tab can make Japanese subtitles on your own computer. Nothing is uploaded. It needs a one-off 564 MB model download and works best in Chrome or Edge.
- **Review:** saved words come back as flashcards with spaced repetition (FSRS), so they actually stick.
- **Words:** see everything you've saved, mark words as known, and export to Anki as CSV.
- **Backup:** save everything (words, reviews, known words, settings) to one file in Settings, and restore it on another device.

Furigana can show on every word, only on words you don't know yet, or not at all.

## Run it locally

You need Node.js 20 or later.

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

Run the tests:

```bash
npm test
```

## Anki

The app can send cards straight to Anki. It works on desktop only, and Anki needs to be open.

1. Install the AnkiConnect add-on in Anki. Use the code `2055492159`, then restart Anki.
2. In the app, open the gear, then **Settings**, then **Connect**. Choose **Yes** in the box Anki shows.
3. Pick a deck and a note type, then press **Check fields**. The app learns your layout from your existing cards of that note type.
4. Press **Looks right**. From then on, **Send** saves the word to Anki.

Each card gets the word, reading, meaning, the sentence with the word in bold, and the second subtitle line. When you save from Watch, it also adds a screenshot and an audio clip of the line.

If Anki is closed, cards wait in a queue and go in later. A waiting card goes to the deck you chose when you saved it.

Mimitori and Anki stay in step both ways. Words already in your deck count as known, so they lose their furigana. Words you mark known in Mimitori get the `mimitori-known` tag in Anki.

If you rename a field in Anki, the app pauses saving and asks you to re-check the fields in Settings.

Not checked yet:

- The hosted (https) version talking to Anki on your computer hasn't been tested. Chrome's private-network rules may block it. Running locally with `npm run dev` works.
- If you rename a field in your note type, saving pauses and asks you to check the field matching again. Automated tests cover this, but it wasn't tried on a real Anki collection.
- The waiting list for when Anki is closed while you save is covered by automated tests too, but wasn't tried live.
- Phones aren't supported for Anki yet.

## Install it as an app

Mimitori works as a web page, but you can also install it so it opens in its own window.

- **Chrome, Edge or Android:** press the install button (the down arrow) at the top of the page.
- **iPhone or iPad:** in Safari, press **Share**, then **Add to Home Screen**.

## Host your own copy

The site is plain static files, so any static host works. It's set up for Cloudflare Pages:

1. Connect the repo in Cloudflare Pages.
2. Set the build command to `npm run build` and the output folder to `dist`.
3. Deploy. The build checks that no file is over Cloudflare's 25 MiB limit.

The speech and manga models come from Hugging Face, and the ONNX runtime comes from jsDelivr, so they don't count against that limit.

## Translation (optional)

The app works fully without translation. If you want sentence translation in the Read tab, deploy the small Cloudflare Worker in `/worker` with your own DeepL API key:

1. Run `wrangler deploy` from inside `/worker`.
2. Set the key with `wrangler secret put DEEPL_API_KEY`.
3. Copy `.env.example` to `.env` and set `VITE_TRANSLATE_WORKER_URL` to your worker's URL.

If the URL isn't set, the translation area doesn't show up at all.

## Privacy

Everything runs in your browser. Videos and subtitle files are played straight from your computer and never uploaded. Saved words live in your browser's storage. There's no tracking.

## Phone apps

The repo includes a Capacitor setup for iOS and Android builds (`npm run cap:sync`, `npm run cap:ios`, `npm run cap:android`). They aren't the focus right now, so expect rough edges.

## Contributing

Issues and pull requests are welcome. Keep changes small and focused, run `npm test` before you open a PR, and say what you tested in the browser.

## Credits

- **JMdict** dictionary data and its frequency marks © the Electronic Dictionary Research and Development Group, used under the [Creative Commons Attribution-ShareAlike 4.0 licence](https://www.edrdg.org/edrdg/licence.html).
- **kuromoji.js** by Takuya Asano, Apache License 2.0. It ships the **IPADIC** dictionary, which has its own permissive licence.
- Spaced repetition by **ts-fsrs** (MIT).
- **transformers.js** by Hugging Face (Apache-2.0) and **ONNX Runtime Web** (MIT) run the speech model in your browser.
- **Mediabunny** (MPL-2.0, used unmodified) reads the audio from your video.
- **pdf.js** by Mozilla (Apache-2.0) reads PDFs in the Read tab.
- **manga-ocr** by kha-white (Apache-2.0) reads speech bubbles. It runs as the ONNX export [kimchireader/manga-ocr-onnx-q8](https://huggingface.co/kimchireader/manga-ocr-onnx-q8) (Apache-2.0), downloaded from Hugging Face when you first read an image page, not bundled.
- **Whisper large-v3 turbo** by OpenAI (MIT) makes the subtitles. It's downloaded from Hugging Face when you use it, not bundled.
- The ear in the logo is based on the ear icon from **Tabler Icons** (MIT). Logo sources and the script that renders the icons live in `brand/`.

## Licence

MIT. See [LICENSE](LICENSE).
