// useAnki.js
// One shared AnkiConnect client plus the status, lists and known-word sync the
// UI needs. Pass active=false to stay silent (no requests) until Anki is wanted.

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore, ankiMode } from "../store";
import { createAnki } from "./connect";
import { readAllDecks, mergeDeckNotes } from "./known";
import { listQueue } from "./queue";
import { syncTags } from "./tags";

export const anki = createAnki();

const SYNC_EVERY = 5 * 60 * 1000;
let lastSync = 0; // shared so two mounted hooks don't both sync on one focus
let syncId = 0; // only the latest sync may write results
let lastForcedKey = null; // mode|deck of the last forced sync

export function useAnki(active = true) {
  const { state, setAnkiWords, setAnkiSettings, setDeckNotes } = useStore();
  const [status, setStatus] = useState("checking"); // checking | ok | unreachable | outdated | forbidden
  const [error, setError] = useState("");
  const [decks, setDecks] = useState([]);
  const [models, setModels] = useState([]);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(null); // { deck, done, total } while syncing
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
      const id = ++syncId;
      const latest = () => id === syncId;
      setSyncing(true);
      try {
        const a = s.settings.anki;
        const { merged, deckNotes: notes, missing } = await readAllDecks(anki, a, (p) => latest() && setProgress(p));
        if (!latest()) return;
        setDeckNotes(mergeDeckNotes(live.current.anki.deckNotes || [], notes));
        const picked = (a.readDecks ?? []).filter((d) => !missing.includes(d));
        if (picked.length < (a.readDecks ?? []).length) setAnkiSettings({ readDecks: picked }); // untick missing decks
        const words = merged;
        // Cards still waiting for Anki aren't in the deck yet; keep them marked.
        const queued = await listQueue().catch(() => []);
        if (!latest()) return;
        const inDeck = { ...words.inDeck };
        queued.forEach((q) => q.base && (inDeck[q.base] = true));
        setAnkiWords({ ...words, inDeck });
        setError("");
        if (a.tagKnown) {
          try {
            await syncTags(anki, a, live.current.known); // the word sync above stays either way
          } catch (e) {
            setError(e.message);
          }
        }
      } catch (e) {
        if (!latest()) return;
        lastSync = 0; // let the next focus try again
        setError(e.message);
      } finally {
        if (latest()) {
          setSyncing(false);
          setProgress(null);
        }
      }
    },
    [setAnkiWords, setAnkiSettings]
  );

  useEffect(() => {
    if (!active) return;
    check();
    const key = `${inMode}|${deck}`;
    const changed = key !== lastForcedKey; // only a real mode/deck change skips the throttle
    if (changed) lastForcedKey = key;
    refreshKnown({ force: changed });
    const onFocus = () => {
      check();
      refreshKnown();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, check, inMode, deck]);

  return { status, error, decks, models, queueCount, syncing, progress, connect, check, refreshKnown, refreshQueue };
}
