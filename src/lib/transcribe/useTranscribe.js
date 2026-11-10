import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createFlags } from "../firstRun.js";
import { initialState, reduce, transcriptKey } from "./state.js";
import { openTranscripts } from "./store.js";

async function detectGpu() {
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) return { webgpu: false, f16: false };
    return { webgpu: true, f16: adapter.features.has("shader-f16") };
  } catch {
    return { webgpu: false, f16: false };
  }
}

export function useTranscribe(file) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const flags = useRef(null);
  flags.current ??= createFlags();
  const [needsModelOk, setNeedsModelOk] = useState(() => !flags.current.has("model-ready"));
  const store = useRef(null);
  const worker = useRef(null);
  const jobCounter = useRef(0);
  const english = useRef(false);
  const fileRef = useRef(file);
  fileRef.current = file;
  const stateRef = useRef(state);
  stateRef.current = state;
  const key = file ? transcriptKey(file) : null;
  const keyRef = useRef(key);
  keyRef.current = key;
  const lastSaved = useRef(initialState.record); // the record already on disk (or empty)
  const loaded = useRef(false);

  const getStore = () => (store.current ??= openTranscripts());

  const killWorker = () => {
    worker.current?.terminate();
    worker.current = null;
  };

  // New file or unmount: drop the worker, reset, then load whatever was saved for this file.
  useEffect(() => {
    killWorker();
    dispatch({ type: "reset" });
    lastSaved.current = initialState.record;
    loaded.current = false;
    english.current = false;
    if (!key) return killWorker;
    getStore()
      .getTranscript(key)
      .then((rec) => {
        if (keyRef.current !== key) return; // the file changed while we were loading
        if (rec) {
          lastSaved.current = rec;
          dispatch({ type: "load", record: rec });
        }
        loaded.current = true;
      });
    return killWorker;
  }, [key]);

  // Save whenever the record changes (cues, done, stopped, edit), but never before the load finishes.
  useEffect(() => {
    if (!keyRef.current || !loaded.current || state.record === lastSaved.current) return;
    lastSaved.current = state.record;
    getStore().putTranscript(keyRef.current, state.record);
  }, [state.record]);

  const startJob = useCallback(async (task, fromS) => {
    const jobId = ++jobCounter.current;
    const jobKey = keyRef.current;
    dispatch({ type: "start", jobId, task, fromS });
    const gpu = await detectGpu();
    if (keyRef.current !== jobKey || jobCounter.current !== jobId) return;
    if (!worker.current) {
      const w = new Worker(new URL("./transcribe.worker.js", import.meta.url), { type: "module" });
      w.onmessage = (e) => {
        const msg = e.data;
        dispatch({ type: "worker", msg });
        if (msg.type === "ready") {
          flags.current.set("model-ready");
          setNeedsModelOk(false);
        } else if (msg.type === "done" && msg.jobId === jobCounter.current && english.current) {
          // Only the Japanese pass chains; english is cleared once the translate job starts.
          if (stateRef.current.task === "transcribe") startJob("translate", 0);
        }
      };
      worker.current = w;
    }
    worker.current.postMessage({ type: "start", jobId, file: fileRef.current, fromS, task, gpu });
  }, []);

  const start = useCallback(
    ({ english: wantEnglish } = {}) => {
      english.current = !!wantEnglish;
      return startJob("transcribe", 0);
    },
    [startJob],
  );
  const carryOn = useCallback(() => startJob("transcribe", stateRef.current.record.doneS), [startJob]);
  const stop = useCallback(() => {
    english.current = false; // stopping also cancels the English follow-up
    worker.current?.postMessage({ type: "stop", jobId: jobCounter.current });
  }, []);
  const editLine = useCallback((index, text) => dispatch({ type: "edit", index, text }), []);
  const setEnglish = useCallback((on) => {
    english.current = !!on;
  }, []);

  return {
    status: state.status,
    task: state.task,
    modelPct: state.modelPct,
    progressS: state.progressS,
    totalS: state.totalS,
    device: state.device,
    record: state.record,
    error: state.error,
    needsModelOk,
    start,
    carryOn,
    stop,
    editLine,
    setEnglish,
  };
}
