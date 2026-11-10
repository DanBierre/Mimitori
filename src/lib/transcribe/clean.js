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
// A hum or grunt Whisper hears in music and breaths: ん, んん, んー, ンっ? (うん stays).
const HUM = /^[\s…。、！？!?.,・〜～~ー-]*[んン][んンーっッ〜～]*[\s…。、！？!?.,・〜～~ー-]*$/;
// Whisper sometimes loops on one short line; this many in a row is a loop.
const LOOP_RUN = 3;

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

// Call once per window: loops are detected within the cues it's given.
export function dropJunk(cues) {
  const kept = cues.filter(
    (c) =>
      !PUNCT_ONLY.test(c.text) &&
      !SOUND_TAG.test(c.text) &&
      !HUM.test(c.text) &&
      !HALLUCINATIONS.some((h) => c.text.includes(h)),
  );
  // Collapse a loop (LOOP_RUN or more identical lines in a row) to its first line.
  return kept.filter((c, i) => {
    if (i === 0 || kept[i - 1].text !== c.text) return true;
    let start = i;
    while (start > 0 && kept[start - 1].text === c.text) start--;
    let end = i;
    while (end + 1 < kept.length && kept[end + 1].text === c.text) end++;
    return end - start + 1 < LOOP_RUN;
  });
}
