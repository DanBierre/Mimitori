import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanOcr, pickOcrRuntime, wholeSequenceInputs, OCR_REVISION } from "./ocr.js";

test("strips spaces", () => {
  assert.equal(cleanOcr("あ た し は ナ ナ"), "あたしはナナ");
});

test("full-width punctuation and digits", () => {
  assert.equal(cleanOcr("OK!? 3,000"), "OK！？３，０００");
});

test("ellipses", () => {
  assert.equal(cleanOcr("まさか..."), "まさか…");
  assert.equal(cleanOcr("え・・・"), "え…");
});

test("pickOcrRuntime is always wasm with q8 (measured faster than WebGPU for this model)", () => {
  assert.deepEqual(pickOcrRuntime(), { device: "wasm", dtype: "q8" });
});

test("wholeSequenceInputs feeds every token so far, with a matching mask", () => {
  class FakeTensor {
    constructor(type, data, dims) { Object.assign(this, { type, data: [...data], dims }); }
  }
  const prepare = wholeSequenceInputs(FakeTensor);
  const out = prepare({}, [[2n, 5n, 7n], [2n, 6n, 8n]], { encoder_outputs: "enc" });
  assert.equal(out.encoder_outputs, "enc");
  assert.deepEqual(out.decoder_input_ids.dims, [2, 3]);
  assert.deepEqual(out.decoder_input_ids.data, [2n, 5n, 7n, 2n, 6n, 8n]);
  assert.deepEqual(out.decoder_attention_mask.dims, [2, 3]);
  assert.deepEqual(out.decoder_attention_mask.data, [1n, 1n, 1n, 1n, 1n, 1n]);
});

test("the model revision is pinned to a commit hash", () => {
  assert.match(OCR_REVISION, /^[0-9a-f]{40}$/);
});
