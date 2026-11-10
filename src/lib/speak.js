// speak.js
// The browser's own Japanese voice. Free and usually offline; no third-party
// audio (Yomitan's usual JapanesePod101 source is used without permission).

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function speak(text) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("ja"));
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}
