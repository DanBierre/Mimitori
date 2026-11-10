// Turns Whisper chunks into app cues ({ start, end, text }, ms) and drops junk.

export const HALLUCINATIONS = [
  "ご視聴ありがとうございました",
  "ご視聴ありがとうございます",
  "チャンネル登録",
  "最後までご視聴",
];

// Windows quieter than this RMS are skipped by the worker.
export const SILENCE_RMS = 0.005;

const PUNCT_ONLY = /^[\s…。、！？!?.,・〜～~♪♫ー-]*$/;
// A line that is only a sound tag, e.g. 音楽 or （拍手）.
const SOUND_TAG = /^[\s(（[［【〔]*(音楽|BGM|拍手|笑い|笑)[\s)）\]］】〕]*$/;

export function toCues(windowStartS, windowEndS, chunks) {
  return chunks.map((c) => {
    const [s, e] = c.timestamp;
    const start = Math.round((windowStartS + s) * 1000);
    return {
      start,
      end: Math.min(
        Math.max(Math.round((e == null ? windowEndS : windowStartS + e) * 1000), start),
        Math.round(windowEndS * 1000),
      ),
      text: c.text.trim(),
    };
  });
}

export function dropJunk(cues) {
  return cues.filter(
    (c) => !PUNCT_ONLY.test(c.text) && !SOUND_TAG.test(c.text) && !HALLUCINATIONS.some((h) => c.text.includes(h)),
  );
}
