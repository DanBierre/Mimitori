// Pure transcript state. The hook feeds worker messages and UI actions through reduce().

export const transcriptKey = (f) => `${f.name}|${f.size}|${f.lastModified}`;

export const emptyRecord = () => ({
  ja: [],
  en: null,
  edited: [],
  doneS: 0,
  totalS: 0,
  done: false,
  enDone: false,
});

// record.doneS/totalS are the Japanese resume point only; progressS/totalS drive the progress row.
export const initialState = {
  status: "idle", // idle | loading-model | running | done | stopped | error
  jobId: 0,
  task: "transcribe",
  device: null,
  modelPct: 0,
  progressS: 0,
  totalS: 0,
  record: emptyRecord(),
  error: null,
};

function onWorker(state, msg) {
  if (msg.jobId !== state.jobId) return state;
  const { record } = state;
  const translate = state.task === "translate";
  switch (msg.type) {
    case "model":
      return { ...state, modelPct: msg.pct };
    case "ready":
      return { ...state, status: "running", device: msg.device };
    case "cues": {
      const progress = { progressS: msg.doneS, totalS: msg.totalS };
      if (translate) {
        return { ...state, ...progress, record: { ...record, en: [...(record.en ?? []), ...msg.cues] } };
      }
      return {
        ...state,
        ...progress,
        record: { ...record, ja: [...record.ja, ...msg.cues], doneS: msg.doneS, totalS: msg.totalS },
      };
    }
    case "done":
      return {
        ...state,
        status: "done",
        record: translate ? { ...record, en: record.en ?? [], enDone: true } : { ...record, done: true },
      };
    case "stopped":
      return {
        ...state,
        status: "stopped",
        record: translate ? record : { ...record, doneS: msg.doneS },
      };
    case "error":
      return { ...state, status: "error", error: { code: msg.code, message: msg.message } };
    default:
      return state;
  }
}

export function reduce(state, action) {
  switch (action.type) {
    case "start": {
      let record = state.record;
      if (action.task === "translate") record = { ...record, en: [], enDone: false };
      return {
        ...state,
        status: "loading-model",
        jobId: action.jobId,
        task: action.task,
        modelPct: 0,
        error: null,
        record,
        progressS: action.task === "translate" ? 0 : record.doneS,
        totalS: record.totalS,
      };
    }
    case "worker":
      return onWorker(state, action.msg);
    case "edit": {
      const ja = state.record.ja.map((c, i) => (i === action.index ? { ...c, text: action.text } : c));
      const edited = state.record.edited.includes(action.index)
        ? state.record.edited
        : [...state.record.edited, action.index];
      return { ...state, record: { ...state.record, ja, edited } };
    }
    case "load":
      return { ...state, record: action.record, progressS: action.record.doneS, totalS: action.record.totalS };
    case "reset":
      return initialState;
    default:
      return state;
  }
}
