// useAnki.js
// One shared AnkiConnect client plus the status, lists and known-word sync the
// UI needs. Pass active=false to stay silent (no requests) until Anki is wanted.

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore, ankiMode } from "../store";
import { createAnki } from "./connect";
import { readAllDecks } from "./known";
import { listQueue } from "./queue";

export const anki = createAnki();

const SYNC_EVERY = 5 * 60 * 1000;
let lastSync = 0; // shared so two mounted hooks don't both sync on one focus

export function useAnki(active = true) {
  const { state, setAnkiWords, setAnkiSettings } = useStore();
  const [status, setStatus] = useState("checking"); // checking | ok | unreachable | outdated | forbidden
  const [error, setError] = useState("");
  const [decks, setDecks] = useState([]);
  const [models, setModels] = useState([]);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(null); // { deck, done, total } while syncing
  const [deckNotes, setDeckNotes] = useState([]);
  const inMode = ankiMode(state); // turning Anki mode on triggers a sync
  const deck = state.settings.anki.deck;
  const live = useRef(state);
  live.current = state;

  const readLists = useCallback(async () => {
    const [d, m] = await Promise.all([anki.invoke("deckNames"), anki.invoke("modelNames")]);
    setDecks(d);
    setModels(m);
  }, []);

  const refreshQueue = useCallback(() => listQueue().then((q) => setQueueCount(q.length)).catch(() => {}), []);

  const check = useCallback(async () => {
    try {
      const s = await anki.checkConnection();
      setStatus(s);
      setError("");
      if (s === "ok") await readLists();
    } catch (e) {
      setStatus("unreachable");
      setError(e.message);
    }
    refreshQueue();
  }, [readLists, refreshQueue]);

  const connect = useCallback(async () => {
    setStatus("checking");
    try {
      const s = await anki.connect();
      setStatus(s);
      setError("");
      if (s === "ok") await readLists();
    } catch (e) {
      setStatus("unreachable");
      setError(e.message);
    }
  }, [readLists]);

  const refreshKnown = useCallback(
    async ({ force = false } = {}) => {
      const s = live.current;
      if (!ankiMode(s)) return;
      if (!force && Date.now() - lastSync < SYNC_EVERY) return;
      lastSync = Date.now();
      setSyncing(true);
      setDeckNotes([]);
      try {
        const a = s.settings.anki;
        const { merged, deckNotes: notes, missing } = await readAllDecks(anki, a, setProgress);
        setDeckNotes(notes);
        const picked = (a.readDecks ?? []).filter((d) => !missing.includes(d));
        if (picked.length < (a.readDecks ?? []).length) setAnkiSettings({ readDecks: picked }); // untick missing decks
        const words = merged;
        // Cards still waiting for Anki aren't in the deck yet; keep them marked.
        const queued = await listQueue().catch(() => []);
        const inDeck = { ...words.inDeck };
        queued.forEach((q) => q.base && (inDeck[q.base] = true));
        setAnkiWords({ ...words, inDeck });
        setError("");
      } catch (e) {
        lastSync = 0; // let the next focus try again
        setError(e.message);
      } finally {
        setSyncing(false);
        setProgress(null);
      }
    },
    [setAnkiWords, setAnkiSettings]
  );

  useEffect(() => {
    if (!active) return;
    check();
    refreshKnown({ force: true }); // mode or deck changed: skip the throttle
    const onFocus = () => {
      check();
      refreshKnown();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, check, inMode, deck]);

  return { status, error, decks, models, queueCount, syncing, progress, deckNotes, connect, check, refreshKnown, refreshQueue };
}
