// Reads one cropped bubble at a time with manga-ocr, in the browser. Nothing is uploaded:
// the only network fetch is the model from Hugging Face, once; the browser keeps it after that.
import { OCR_MODEL, OCR_REVISION, pickOcrRuntime, cleanOcr, wholeSequenceInputs } from "./ocr.js";

let pipePromise = null;
let queue = Promise.resolve(); // one bubble at a time

const post = (msg) => self.postMessage(msg);

class JobError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// phase says where the failure happened; the error itself rarely says.
function toError(e, phase) {
  if (e instanceof JobError) return e;
  const message = String(e?.message ?? e);
  if (e?.name === "QuotaExceededError") return new JobError("storage", message);
  if (phase === "model") return new JobError("model-download", message);
  return new JobError("unknown", message);
}

function loadModel() {
  pipePromise ??= (async () => {
    const { pipeline, env, Tensor } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    // ONNX runtime comes from jsdelivr, pinned by transformers to its own onnxruntime-web version.
    // Self-hosting it put a 26 MB file in dist, over Cloudflare's 25 MiB per-file limit.
    const { device, dtype } = pickOcrRuntime();
    const files = new Map();
    let lastPct = -1;
    const pipe = await pipeline("image-to-text", OCR_MODEL, {
      revision: OCR_REVISION,
      device,
      dtype,
      progress_callback: (p) => {
        if (p.status !== "progress" || !p.total) return;
        files.set(p.file, { loaded: p.loaded, total: p.total });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        const pct = Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
        if (pct > lastPct) {
          lastPct = pct;
          post({ type: "model", pct });
        }
      },
    });
    pipe.model._prepare_inputs_for_generation = wholeSequenceInputs(Tensor);
    return { pipe, device };
  })();
  pipePromise.catch(() => {
    pipePromise = null; // let the next try start again
  });
  return pipePromise;
}

async function load() {
  try {
    const { device } = await loadModel();
    post({ type: "ready", device });
  } catch (e) {
    const err = toError(e, "model");
    post({ type: "error", code: err.code, message: err.message });
  }
}

async function read({ id, bitmap }) {
  let phase = "model";
  try {
    const { pipe, device } = await loadModel();
    post({ type: "ready", device });
    phase = "infer";
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // transparent pixels would read as black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const { RawImage } = await import("@huggingface/transformers");
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const out = await pipe(new RawImage(data, width, height, 4));
    post({ type: "text", id, text: cleanOcr(out?.[0]?.generated_text ?? "") });
  } catch (e) {
    const err = toError(e, phase);
    post({ type: "error", id, code: err.code, message: err.message });
  }
}

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "load") {
    queue = queue.then(load).catch(() => {});
  } else if (msg.type === "read") {
    queue = queue.then(() => read(msg)).catch(() => {});
  }
};
