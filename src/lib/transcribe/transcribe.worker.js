// Reads a video file in chunks, turns the audio into 16 kHz windows and runs
// Whisper on each. Everything stays in this worker; nothing is uploaded.
import { downmix, resample } from "./audio.js";
import { toCues, dropJunk } from "./clean.js";
import { createWindower, pickRuntime, MODEL_ID } from "./windows.js";
// ONNX runtime files. transformers.js would otherwise fetch these from jsdelivr.
// This is transformers' own pinned onnxruntime-web, resolved through it; the build fails loudly if that changes.
import ortMjs from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import ortWasm from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";

let asrPromise = null;
let activeJob = null;
const stopped = new Set(); // jobIds asked to stop
let queue = Promise.resolve(); // jobs run one at a time, so two never use the pipeline together

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
  if (phase === "decode") return new JobError("cant-decode", message);
  // phase "infer" (and anything else) falls through to unknown
  return new JobError("unknown", message);
}

function loadModel(jobId, gpu) {
  // Built once per worker; a later job asking for another device reuses it.
  asrPromise ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowLocalModels = false;
    env.backends.onnx.wasm.wasmPaths = { mjs: ortMjs, wasm: ortWasm };
    const { device, dtype } = pickRuntime(gpu);
    const files = new Map();
    let lastPct = -1;
    const asr = await pipeline("automatic-speech-recognition", MODEL_ID, {
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
          post({ type: "model", jobId: activeJob, pct });
        }
      },
    });
    return { asr, device };
  })();
  asrPromise.catch(() => {
    asrPromise = null; // let the next job retry
  });
  return asrPromise;
}

async function run({ jobId, file, fromS, task, gpu }) {
  let phase = "unknown";
  // A newer start supersedes this job, so it stops too.
  const isStopped = () => jobId !== activeJob || stopped.has(jobId);
  try {
    if (isStopped()) {
      post({ type: "stopped", jobId, doneS: fromS });
      return;
    }
    phase = "model";
    const { asr, device } = await loadModel(jobId, gpu);
    post({ type: "ready", jobId, device });

    phase = "decode";
    const { Input, ALL_FORMATS, BlobSource, AudioSampleSink } = await import("mediabunny");
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new JobError("no-audio", "This video has no audio track.");
    if (!(await track.canDecode())) {
      throw new JobError("cant-decode", "This audio format can't be decoded here.");
    }
    const totalS = await track.computeDuration();

    const windower = createWindower({ rate: 16000, startS: fromS });
    let doneS = fromS;

    const handle = async (win) => {
      let cues = [];
      if (!win.silent) {
        phase = "infer";
        const out = await asr(win.samples, { language: "japanese", task, return_timestamps: true });
        cues = dropJunk(toCues(win.startS, win.endS, out.chunks ?? []));
        phase = "decode";
      }
      doneS = win.endS;
      post({ type: "cues", jobId, cues, doneS, totalS });
    };

    for await (const sample of new AudioSampleSink(track).samples(fromS)) {
      if (isStopped()) {
        sample.close();
        break;
      }
      // The first sample can start before fromS; skip those frames so a resume doesn't repeat audio.
      const skip = Math.max(0, Math.round((fromS - sample.timestamp) * sample.sampleRate));
      const frameCount = sample.numberOfFrames - skip;
      if (frameCount <= 0) {
        sample.close();
        continue;
      }
      const planes = [];
      for (let i = 0; i < sample.numberOfChannels; i++) {
        const opts = { format: "f32-planar", planeIndex: i, frameOffset: skip, frameCount };
        const plane = new Float32Array(sample.allocationSize(opts) / 4);
        sample.copyTo(plane, opts);
        planes.push(plane);
      }
      const rate = sample.sampleRate;
      sample.close();
      for (const win of windower.push(resample(downmix(planes), rate))) {
        await handle(win);
        if (isStopped()) break;
      }
      if (isStopped()) break;
    }

    if (isStopped()) {
      post({ type: "stopped", jobId, doneS });
      return;
    }
    for (const win of windower.flush()) {
      await handle(win);
      if (isStopped()) {
        post({ type: "stopped", jobId, doneS });
        return;
      }
    }
    post({ type: "done", jobId });
  } catch (e) {
    const err = toError(e, phase);
    post({ type: "error", jobId, code: err.code, message: err.message });
  }
}

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "stop") stopped.add(msg.jobId);
  else if (msg.type === "start") {
    activeJob = msg.jobId;
    queue = queue.then(() => run(msg));
  }
};
