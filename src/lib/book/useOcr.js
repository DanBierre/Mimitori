// Owns the OCR worker. The model download needs the learner's OK once (a localStorage flag).
import { useCallback, useEffect, useRef, useState } from "react";

const OK_KEY = "mimitori:ocr-model-ok";
const hasOk = () => {
  try {
    return localStorage.getItem(OK_KEY) === "1";
  } catch {
    return false;
  }
};

// status: "needs-ok" | "downloading" | "ready" | "error" ("idle" before the hook has decided).
// read(bitmap) -> Promise<string>; rejects with an Error whose .code is the worker's error code.
export function useOcr() {
  const [status, setStatus] = useState(() => (hasOk() ? "downloading" : "needs-ok"));
  const [modelPct, setModelPct] = useState(0);
  const [device, setDevice] = useState(null);
  const [error, setError] = useState(null);
  const worker = useRef(null);
  const jobs = useRef(new Map());
  const nextId = useRef(1);
  const started = useRef(false);

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setError(null);
    setStatus("downloading");
    const w = new Worker(new URL("./ocr.worker.js", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === "model") setModelPct(msg.pct);
      else if (msg.type === "ready") {
        setDevice(msg.device);
        setStatus("ready");
      } else if (msg.type === "text") {
        jobs.current.get(msg.id)?.resolve(msg.text);
        jobs.current.delete(msg.id);
      } else if (msg.type === "error") {
        const err = Object.assign(new Error(msg.message), { code: msg.code });
        if (msg.id != null) {
          jobs.current.get(msg.id)?.reject(err);
          jobs.current.delete(msg.id);
        } else {
          // the model itself failed to load: let the learner try again
          setError(err);
          setStatus("error");
          w.terminate();
          worker.current = null;
          started.current = false;
        }
      }
    };
    w.postMessage({ type: "load" });
  }, []);

  useEffect(() => {
    if (hasOk()) start();
    return () => {
      worker.current?.terminate();
      worker.current = null;
      started.current = false;
      for (const j of jobs.current.values()) j.reject(Object.assign(new Error("closed"), { code: "unknown" }));
      jobs.current.clear();
    };
  }, [start]);

  const allowDownload = useCallback(() => {
    try {
      localStorage.setItem(OK_KEY, "1");
    } catch {
      /* the flag just won't stick */
    }
    start();
  }, [start]);

  const read = useCallback(
    (bitmap) =>
      new Promise((resolve, reject) => {
        if (!worker.current) {
          reject(Object.assign(new Error("The reader isn't loaded."), { code: "model-download" }));
          return;
        }
        const id = nextId.current++;
        jobs.current.set(id, { resolve, reject });
        worker.current.postMessage({ type: "read", id, bitmap }, [bitmap]);
      }),
    [],
  );

  return { status, modelPct, device, error, allowDownload, read };
}
