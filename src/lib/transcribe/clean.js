// Turns Whisper chunks into app cues ({ start, end, text }, ms) and drops junk.

export const HALLUCINATIONS = [
  "ご視聴ありがとうございました",
  "ご視聴ありがとうございます",
  "チャンネル登録",
  "最後までご視聴",
];

// Windows quieter than this RMS are skipped by the worker.
export const SILENCE_RMS = 0.005;

const PUNCT_ONLY = /^[\s…。、！？!?.,・〜ー-]*$/;

export function toCues(windowStartS, windowEndS, chunks) {
  return chunks.map((c) => {
    const [s, e] = c.timestamp;
    return {
      start: Math.round((windowStartS + s) * 1000),
      end: Math.round((e == null ? windowEndS : windowStartS + e) * 1000),
      text: c.text.trim(),
    };
  });
}

export function dropJunk(cues) {
  return cues.filter(
    (c) => !PUNCT_ONLY.test(c.text) && !HALLUCINATIONS.some((h) => c.text.includes(h)),
  );
}
