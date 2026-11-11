# Product

## Platform

web

## Users
Self-directed Japanese learners at any level, from beginner to advanced, who today juggle Anki, WaniKani, Bunpro and a dictionary. They study in short phone sessions (commute, breaks) and longer desktop sessions reading real Japanese (news, manga text, games, articles). Their job: understand real text now, and make sure the words they meet actually stick.

## Product Purpose
An all-in-one, low-cost study tool that closes the loop other apps leave open: read real Japanese, tap any word for its meaning, save it, and review it with spaced repetition in the same app. Success = a learner can drop Anki as their daily driver and reads progressively harder text with less furigana over time.

## Positioning
Reading-first SRS: the card queue is built from words the learner actually met in text they cared about, with furigana and difficulty that adapt to words they already know. WaniKani is a fixed curriculum; Anki has no content or reading; immersion tools (Migaku, LingQ) are expensive.

## Operating Context
Pasted or imported Japanese text is tokenized locally (kuromoji.js, dictionary in public/dict). Sentence translation goes through a Cloudflare Worker holding the DeepL key (worker/). Delivered as a React + Vite web app wrapped with Capacitor for iOS/Android; phone-first, must work well on desktop. CSV export is the Anki escape hatch for now; phone Anki export isn't available right now.

## Capabilities and Constraints
- Free and open source (MIT). No pricing, no accounts.
- Existing: local furigana, offline JMdict word lookup, FSRS review, saved and known words, level-adaptive furigana, CSV export (phone Anki export not available right now), optional DeepL sentence translation.
- Watch: play the learner's own video with their own subtitle files (.srt, .vtt, .ass), with furigana, tap-for-meaning, line replay, pause after each line, speed, transcript and timing fixes. Files never leave the device.
- Read manga and PDFs (desktop first): open a CBZ, an image folder or a PDF in Read, box a speech bubble and get the line with furigana and tap-for-meaning. Text PDFs read their own text; image pages are read by an OCR model that downloads once (about 117 MB) and runs in the browser. Anki cards from a book get the bubble as the picture and "title, p. N" as the source. Files never leave the device.
- Anki auto-cards (desktop): send a word, sentence, second subtitle line, screenshot and audio clip to Anki via AnkiConnect, learning the learner's note layout. Cards queue when Anki is closed; words already in the chosen deck count as known.
- Local-first: words, SRS state and known-words live on device. No accounts or sync in v1; UI should leave room for sign-in/sync later.
- JMdict is CC-BY-SA: attribution required in-app. Do not copy WaniKani content.
- DeepL free tier is limited; translation must be cached and later rate-limited per account. Translation is optional: the public build ships without a worker URL.
- Later: graded content library, camera OCR, mokuro import, automatic bubble finding, Android Anki plugin, kanji info, name dictionary, Yomitan dictionary import.

## Brand Commitments
Name: **Mimitori** (耳取り, "catching it by ear"; a play on 聞き取り). Chosen by Dan on 11 November 2026, replacing the placeholder "Nihongo Reader". Domain: **mimitori.com** (registered on Cloudflare, 11 November 2026). No logo or voice commitments exist yet.
- Look: "Quiet precision, personal" (chosen by Dan on 11 November 2026, replacing the 10 November player look he found plain). Sleek and near-bare like Linear or Things; the learner's own progress is the only decoration; the learner picks their accent ink. No decorative themes.
- Dan's signature design philosophy (shared across his apps; each app keeps its own visual identity): calm, nothing shouts; hierarchy from size and spacing, not bold, boxes or colour blocks; hairlines, not cards; shadow only on things that float; one accent used sparingly; hand-made, imperfect marks for progress; lots of space; light and dark by device.
- Entirely separate from Dan's Shoji app: no warm cream paper, no Murecho, no vertical side labels, no vermilion, no ensō or seals, no capsule ink-well controls.
- Follows the device light/dark setting; Watch always sits on a dark stage.

## Evidence on Hand
Working prototype in src/ and worker/. No users, testimonials, benchmarks, or pricing data exist; none may be fabricated.

## Product Principles
- The reading-to-review loop is the product; every screen serves moving a word from "met in text" to "known".
- Useful at any level: beginners and advanced learners get the same app, tuned by what they already know.
- Local-first and cheap to run: core features work offline and cost almost nothing per user.
- Respect the learner's existing habits: import/export with Anki rather than lock-in.
- Phone sessions are short; every core action is thumb-reachable and fast.

## Accessibility & Inclusion
Japanese typography must render correctly (ruby, vertical-safe line heights); font size and furigana controls are first-class; respect reduced motion and sufficient contrast. No other product-specific standard established.
