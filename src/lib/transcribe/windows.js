// Cuts a stream of 16 kHz mono blocks into ~30 s windows at quiet points.
// Memory stays bounded: only the un-cut tail is ever held.

import { pickCut, rms } from "./audio.js";
import { SILENCE_RMS } from "./clean.js";

// A real last word under 2 s is lost; merge a short tail into the previous window if that matters.
export const MIN_WINDOW_S = 2;
export const MODEL_ID = "onnx-community/whisper-large-v3-turbo";

export function createWindower({ rate = 16000, windowS = 30, searchS = 3, startS = 0 } = {}) {
  let buf = new Float32Array(Math.ceil((windowS + 5) * rate));
  let len = 0;
  let done = 0; // samples already emitted

  const emit = (n) => {
    const samples = buf.slice(0, n);
    const win = {
      startS: startS + done / rate,
      endS: startS + (done + n) / rate,
      samples,
      silent: samples.length / rate < MIN_WINDOW_S || rms(samples) < SILENCE_RMS,
    };
    done += n;
    buf.copyWithin(0, n, len);
    len -= n;
    return win;
  };

  return {
    push(block) {
      if (len + block.length > buf.length) {
        const bigger = new Float32Array(Math.max(buf.length * 2, len + block.length));
        bigger.set(buf.subarray(0, len));
        buf = bigger;
      }
      buf.set(block, len);
      len += block.length;
      const out = [];
      while (len >= windowS * rate) {
        out.push(emit(pickCut(buf.subarray(0, len), rate, windowS, searchS)));
      }
      return out;
    },
    flush() {
      return len > 0 ? [emit(len)] : [];
    },
    bufferedSeconds: () => len / rate,
  };
}

export function pickRuntime({ webgpu, f16 }) {
  const q = webgpu && f16 ? "q4f16" : "q4";
  return {
    device: webgpu ? "webgpu" : "wasm",
    dtype: { encoder_model: q, decoder_model_merged: q },
  };
}
