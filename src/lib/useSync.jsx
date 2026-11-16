// useSync.jsx
// Signed in, the words sync on their own: when the app opens, about 5 seconds after a change,
// and when the app comes back into view. Signed out, nothing leaves the device.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "./store";
import * as server from "./account";

const SyncContext = createContext(null);
const QUIET = 5000; // wait this long after the last change before saving
const AGAIN = 60_000; // coming back into view syncs at most once a minute

export function SyncProvider({ children }) {
  const store = useStore();
  const [account, setAccount] = useState(server.loadAccount);
  const [status, setStatus] = useState({ busy: false, at: 0, error: "" });
  const latest = useRef(store);
  latest.current = store;
  const held = useRef(""); // fingerprint of what the server holds, so an unchanged state never syncs
  const running = useRef(null);
  const lastRun = useRef(0);

  const forget = useCallback(() => {
    server.saveAccount(null);
    setAccount(null);
    held.current = "";
  }, []);

  const sync = useCallback(async () => {
    const token = server.loadAccount()?.session;
    if (!token) return;
    // One at a time; a change made during a sync gets its own turn afterwards
    if (running.current) return running.current;
    lastRun.current = Date.now();
    setStatus((s) => ({ ...s, busy: true }));
    running.current = server
      .syncOnce(token, () => latest.current.state, (remote) => latest.current.synced(remote))
      .then((print) => {
        held.current = print;
        setStatus({ busy: false, at: Date.now(), error: "" });
      })
      .catch((e) => {
        if (e.status === 401) forget();
        setStatus((s) => ({ ...s, busy: false, error: e.message }));
      })
      .finally(() => {
        running.current = null;
      });
    return running.current;
  }, [forget]);

  // Open, and signed in: sync now
  useEffect(() => {
    if (account) sync();
  }, [account, sync]);

  // A change: sync once things go quiet, if it changed what travels
  useEffect(() => {
    if (!account) return;
    const t = setTimeout(() => {
      if (server.fingerprint(latest.current.state) !== held.current) sync();
    }, QUIET);
    return () => clearTimeout(t);
  }, [store.state, account, sync]);

  // Back into view: pick up what another device saved meanwhile
  useEffect(() => {
    if (!account) return;
    const back = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun.current > AGAIN) sync();
    };
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", back);
    return () => {
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", back);
    };
  }, [account, sync]);

  const api = useMemo(() => {
    const signedIn = (a) => {
      server.saveAccount(a);
      setStatus({ busy: false, at: 0, error: "" });
      setAccount(a);
    };
    return {
      account,
      status,
      sync,
      startSignIn: server.startSignIn,
      finishSignIn: async (email, code, password) => signedIn(await server.finishSignIn(email, code, password)),
      logIn: async (email, password) => signedIn(await server.logIn(email, password)),
      signOut: async () => {
        await server.signOut(account?.session);
        forget();
      },
      deleteAccount: async () => {
        await server.deleteAccount(account?.session);
        forget();
      },
    };
  }, [account, status, sync, forget]);

  return <SyncContext.Provider value={api}>{children}</SyncContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useAccount must be used inside SyncProvider");
  return ctx;
}
