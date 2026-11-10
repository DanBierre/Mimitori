// ankiExport.js
// New — not part of the original extension. Handles sending a looked-up
// word to Anki, using a different mechanism per platform:
//
//   iOS:     AnkiMobile's x-callback-url scheme. Works from plain web
//            code with no native plugin needed.
//   Android: AnkiDroid's Instant-Add API, which requires native code —
//            so on Android this calls a Capacitor plugin (native shim
//            lives in android/, added once you run `npx cap add android`).
//
// Both are wired behind the same sendToAnki() call so the rest of the
// app doesn't need to know which platform it's on.

import { Capacitor } from "@capacitor/core";

// Configure these to match a note type/deck you've set up in Anki.
// "Term"/"Reading"/"Meaning"/"Sentence" below assume a custom note type
// with those field names — adjust to match your own deck, or make this
// a user-facing setting later.
const DEFAULT_DECK = "Nihongo Reader";
const DEFAULT_NOTE_TYPE = "Basic";

export async function sendToAnki({ term, reading, meaning, sentence }) {
  const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"

  if (platform === "ios") {
    return sendViaAnkiMobileUrlScheme({ term, reading, meaning, sentence });
  }

  if (platform === "android") {
    return sendViaAnkiDroidPlugin({ term, reading, meaning, sentence });
  }

  throw new Error(
    "Anki export isn't available in a plain browser — build and run this via Capacitor on iOS or Android."
  );
}

function sendViaAnkiMobileUrlScheme({ term, reading, meaning, sentence }) {
  const params = new URLSearchParams({
    profile: "User 1", // TODO: make configurable — must match the AnkiMobile profile name exactly
    type: DEFAULT_NOTE_TYPE,
    deck: DEFAULT_DECK,
    fldFront: term,
    fldBack: [reading, meaning, sentence].filter(Boolean).join("<br>"),
    // x-success lets AnkiMobile bounce the user straight back to this
    // app after adding the card, instead of leaving them stranded in Anki.
    "x-success": `${window.location.origin}${window.location.pathname}?anki=added`,
  });

  window.location.href = `anki://x-callback-url/addnote?${params.toString()}`;
  return Promise.resolve();
}

async function sendViaAnkiDroidPlugin({ term, reading, meaning, sentence }) {
  // Placeholder for the native Capacitor plugin. AnkiDroid's Instant-Add
  // API is a permissioned local API (ContentProvider), which means it
  // needs actual native Kotlin/Java code — it can't be called from JS
  // directly the way the iOS URL scheme can.
  //
  // Next step: scaffold a small Capacitor plugin (e.g. capacitor-plugin-ankidroid)
  // that wraps AnkiDroid's AddContentApi and exposes an `addNote()` method
  // here. Until that plugin exists, this throws so the failure is obvious
  // during development rather than silently doing nothing.
  throw new Error(
    "AnkiDroid export needs a native Capacitor plugin — not yet implemented. See comment in ankiExport.js."
  );
}
