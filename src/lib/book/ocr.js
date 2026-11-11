// Manga OCR constants and clean-up (pure). The model runs in ocr.worker.js.
export const OCR_MODEL = "kimchireader/manga-ocr-onnx-q8";
export const OCR_REVISION = "8e15f1319f1ed70b9560a39f42340dd19ee49f92";
export const OCR_SIZE_MB = 117;

// WASM with q8: on this model it measured about 1.4 s per bubble, against about 3.3 s on WebGPU (11 Nov 2026).
export const pickOcrRuntime = () => ({ device: "wasm", dtype: "q8" });

// This model's decoder has no key-value cache, but transformers.js 4.3.2 feeds a cache-less decoder only the
// last token each step, which gives garbage. Feed every token so far, with a mask of the same length.
// Set it on the loaded model: pipe.model._prepare_inputs_for_generation = wholeSequenceInputs(Tensor).
export const wholeSequenceInputs = (Tensor) => (self, inputIds, modelInputs) => {
  const batch = inputIds.length;
  const len = inputIds[0].length;
  return {
    ...modelInputs,
    decoder_input_ids: new Tensor("int64", BigInt64Array.from(inputIds.flat()), [batch, len]),
    decoder_attention_mask: new Tensor("int64", new BigInt64Array(batch * len).fill(1n), [batch, len]),
  };
};

const FULL = /[0-9!?,.:;()~]/g;

// The tokenizer prints one character per token with spaces between; the line reads without any.
export function cleanOcr(text) {
  return text
    .replace(/\s+/g, "")
    .replace(/\.{3,}|・{2,}/g, "…")
    .replace(FULL, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
}
