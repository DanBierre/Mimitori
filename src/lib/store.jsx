// store.jsx
// Local-first app state: saved words (with FSRS cards), known words, and
// reading settings. Everything lives in localStorage on the device; sync and
// accounts are a later layer.

import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import { becameKnown, gradeCard, isDue, newCard } from "./srs";

const STORAGE_KEY = "nihongo-reader:v1";

const DEFAULT_STATE = {
  words: {}, // keyed by dictionary form
  known: {}, // dictionary form -> true
  // furigana: all | unknown | off
  settings: { furigana: "unknown", size: 26, watch: { autoPause: false, speed: 1, showSecondLine: true } },
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return {
      words: parsed.words || {},
      known: parsed.known || {},
      settings: {
        ...DEFAULT_STATE.settings,
        ...(parsed.settings || {}),
        watch: { ...DEFAULT_STATE.settings.watch, ...(parsed.settings?.watch || {}) },
      },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function persist(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked; the app keeps working in memory.
  }
}

function reducer(state, action) {
  switch (action.type) {
    case "save": {
      const { entry } = action;
      if (state.words[entry.base]) return state;
      const known = { ...state.known };
      delete known[entry.base];
      return {
        ...state,
        known,
        words: { ...state.words, [entry.base]: { ...entry, addedAt: Date.now(), card: newCard() } },
      };
    }
    case "remove": {
      const words = { ...state.words };
      delete words[action.base];
      return { ...state, words };
    }
    case "know": {
      const words = { ...state.words };
      delete words[action.base];
      return { ...state, words, known: { ...state.known, [action.base]: true } };
    }
    case "unknow": {
      const known = { ...state.known };
      delete known[action.base];
      return { ...state, known };
    }
    case "grade": {
      const word = state.words[action.base];
      if (!word) return state;
      const card = gradeCard(word.card, action.rating);
      const next = { ...state, words: { ...state.words, [action.base]: { ...word, card } } };
      if (becameKnown(card)) next.known = { ...state.known, [action.base]: true };
      return next;
    }
    case "settings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "watch":
      return { ...state, settings: { ...state.settings, watch: { ...state.settings.watch, ...action.patch } } };
    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => persist(state), [state]);

  const api = useMemo(
    () => ({
      state,
      saveWord: (entry) => dispatch({ type: "save", entry }),
      removeWord: (base) => dispatch({ type: "remove", base }),
      knowWord: (base) => dispatch({ type: "know", base }),
      unknowWord: (base) => dispatch({ type: "unknow", base }),
      grade: (base, rating) => dispatch({ type: "grade", base, rating }),
      setSettings: (patch) => dispatch({ type: "settings", patch }),
      setWatchSettings: (patch) => dispatch({ type: "watch", patch }),
    }),
    [state]
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

// "known" | "due" | "saved" | "new" for a dictionary form.
export function wordState(state, base, now = new Date()) {
  if (state.known[base]) return "known";
  const word = state.words[base];
  if (!word) return "new";
  return isDue(word.card, now) ? "due" : "saved";
}

export function useDueWords() {
  const { state } = useStore();
  return useMemo(() => {
    const now = new Date();
    return Object.values(state.words)
      .filter((w) => isDue(w.card, now))
      .sort((a, b) => new Date(a.card.due) - new Date(b.card.due));
  }, [state.words]);
}
