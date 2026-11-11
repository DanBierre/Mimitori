// store.jsx
// Local-first app state: saved words (with FSRS cards), known words, and
// reading settings. Everything lives in localStorage on the device; sync and
// accounts are a later layer.

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer } from "react";
import { becameKnown, dailyQueue, gradeCard, newCard } from "./srs";
import { deleteImage } from "./images";
import { loadCommon } from "./common";
import { applyInk } from "./ink";
export { ankiMode, wordState } from "./anki/settingsLogic";

// Old app name kept on purpose: renaming the key would wipe saved words and settings.
const STORAGE_KEY = "nihongo-reader:v1";

const DEFAULT_STATE = {
  words: {}, // keyed by dictionary form
  known: {}, // dictionary form -> time marked (true on older data)
  // furigana: all | unknown | off
  settings: {
    furigana: "unknown",
    size: 26,
    commonKnown: true, // treat very common words as known
    ink: "indigo", // the learner's accent colour
    name: "", // optional, for the Watch greeting
    ambient: true, // soft light from the video on the Watch stage
    watch: { autoPause: false, speed: 1, showSecondLine: true },
    anki: { enabled: false, deck: "", model: "", mapping: {}, fieldList: [], readDecks: [], tagKnown: false },
  },
  // Words read from Anki: mature ("known") and in the deck but not yet mature.
  anki: { known: {}, inDeck: {}, syncedAt: 0, deckNotes: [] },
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
        anki: { ...DEFAULT_STATE.settings.anki, ...(parsed.settings?.anki || {}) },
      },
      anki: { ...DEFAULT_STATE.anki, ...(parsed.anki || {}) },
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
    // Undo for remove / know: put the saved word back exactly as it was, review history and all.
    case "restore": {
      const known = { ...state.known };
      delete known[action.word.base];
      return { ...state, known, words: { ...state.words, [action.word.base]: action.word } };
    }
    case "know": {
      const words = { ...state.words };
      delete words[action.base];
      return { ...state, words, known: { ...state.known, [action.base]: Date.now() } };
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
      if (becameKnown(card)) next.known = { ...state.known, [action.base]: Date.now() };
      return next;
    }
    case "settings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "watch":
      return { ...state, settings: { ...state.settings, watch: { ...state.settings.watch, ...action.patch } } };
    case "ankiSettings":
      return { ...state, settings: { ...state.settings, anki: { ...state.settings.anki, ...action.patch } } };
    case "ankiWords":
      return { ...state, anki: { ...state.anki, known: action.known, inDeck: action.inDeck, syncedAt: Date.now() } };
    case "ankiNotes":
      return { ...state, anki: { ...state.anki, deckNotes: action.notes } };
    case "commonReady": // the common-words list arrived; new object so consumers re-render
      return { ...state };
    case "markInAnki":
      return { ...state, anki: { ...state.anki, inDeck: { ...state.anki.inDeck, [action.base]: true } } };
    default:
      return state;
  }
}

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => persist(state), [state]);
  useLayoutEffect(() => applyInk(state.settings.ink), [state.settings.ink]);
  useEffect(() => {
    loadCommon().then(() => dispatch({ type: "commonReady" }));
  }, []);

  const api = useMemo(
    () => ({
      state,
      saveWord: (entry) => dispatch({ type: "save", entry }),
      // Scene stills live in IndexedDB; drop them when the word leaves the list.
      removeWord: (base) => {
        dispatch({ type: "remove", base });
        deleteImage(base);
      },
      knowWord: (base) => {
        dispatch({ type: "know", base });
        deleteImage(base);
      },
      unknowWord: (base) => dispatch({ type: "unknow", base }),
      // The scene still was already deleted with the word, so an undone word comes back without it.
      restoreWord: (word) => dispatch({ type: "restore", word }),
      grade: (base, rating) => dispatch({ type: "grade", base, rating }),
      setSettings: (patch) => dispatch({ type: "settings", patch }),
      setWatchSettings: (patch) => dispatch({ type: "watch", patch }),
      setAnkiSettings: (patch) => dispatch({ type: "ankiSettings", patch }),
      markInAnki: (base) => dispatch({ type: "markInAnki", base }),
      setDeckNotes: (notes) => dispatch({ type: "ankiNotes", notes }),
      setAnkiWords: ({ known, inDeck }) => dispatch({ type: "ankiWords", known, inDeck }),
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

// Today's review: capped at 20 (see dailyQueue); the rest stay due and wait.
export function useReviewToday() {
  const { state } = useStore();
  return useMemo(() => dailyQueue(Object.values(state.words)), [state.words]);
}

export function knownTotal(state) {
  return new Set([...Object.keys(state.known), ...Object.keys(state.anki.known)]).size;
}
