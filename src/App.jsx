import { useEffect, useState } from "react";
import { anki, useAnki } from "./lib/anki/useAnki";
import { flushQueue } from "./lib/anki/queue";
import { StoreProvider, ankiMode, useReviewToday, useStore } from "./lib/store";
import ReadView from "./components/ReadView";
import WatchView from "./components/WatchView";
import ReviewView from "./components/ReviewView";
import WordsView from "./components/WordsView";
import SettingsView from "./components/SettingsView";
import Icon from "./components/Icon";
import { useMarker } from "./lib/useMarker";
import { createFlags } from "./lib/firstRun";
import { isDark } from "./lib/ink";
import "./App.css";

const TABS = [
  { id: "read", label: "Read", icon: "read" },
  { id: "watch", label: "Watch", icon: "watch" },
  { id: "review", label: "Review", icon: "review" },
  { id: "words", label: "Words", icon: "words" },
];

const flags = createFlags();

// Chrome, Edge and Android offer to install the site as an app. Catch the offer early, before the shell mounts.
// No iOS or Firefox prompt exists; there it's Share > Add to Home Screen, which the README covers.
let installOffer = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installOffer = e;
  window.dispatchEvent(new Event("install-offer"));
});
window.addEventListener("appinstalled", () => {
  installOffer = null;
  window.dispatchEvent(new Event("install-offer"));
});

function useInstallOffer() {
  const [offer, setOffer] = useState(installOffer);
  useEffect(() => {
    const sync = () => setOffer(installOffer);
    window.addEventListener("install-offer", sync);
    return () => window.removeEventListener("install-offer", sync);
  }, []);
  if (!offer) return null;
  return async () => {
    offer.prompt();
    await offer.userChoice;
    installOffer = null; // each offer can only be used once
    setOffer(null);
  };
}

function Shell() {
  // First visit lands on Watch, where the sample clip is one tap away. After that, Read as before.
  const [tab, setTab] = useState(() => (flags.has("visited") ? "read" : "watch"));
  useEffect(() => flags.set("visited"), []);
  // Settings remembers where you came from, so Back (or the gear again) returns there.
  const [prevTab, setPrevTab] = useState("read");
  const openSettings = () => {
    if (tab === "settings") return setTab(prevTab);
    setPrevTab(tab);
    setTab("settings");
  };
  const backLabel = TABS.find((t) => t.id === prevTab)?.label ?? "Read";
  const railRef = useMarker('[aria-current="page"] .rail__label');
  const today = useReviewToday();
  const { state, setSettings } = useStore();
  const inAnkiMode = ankiMode(state);
  const dark = isDark(state.settings.theme);
  const install = useInstallOffer();
  const { queueCount, refreshQueue } = useAnki(inAnkiMode && tab !== "settings"); // keeps known words fresh; Settings runs its own

  // Send waiting cards when the app gains focus and every 30 s while any wait.
  useEffect(() => {
    if (!inAnkiMode) return;
    const flush = () => flushQueue(anki).then(refreshQueue).catch(() => {});
    window.addEventListener("focus", flush);
    window.addEventListener("anki-queue-changed", refreshQueue);
    const timer = queueCount > 0 ? setInterval(flush, 30000) : null;
    return () => {
      window.removeEventListener("focus", flush);
      window.removeEventListener("anki-queue-changed", refreshQueue);
      clearInterval(timer);
    };
  }, [inAnkiMode, queueCount, refreshQueue]);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          <svg className="app__logo" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 10a7 7 0 1 1 13 3.6a10 10 0 0 1 -2 2a8 8 0 0 0 -2 3a4.5 4.5 0 0 1 -6.8 1.4" />
            <path d="M10.6 10a2.4 2.4 0 1 1 4.2 1.6" />
          </svg>
          mimitori
        </h1>
        <nav className="rail" aria-label="Sections" ref={railRef}>
          <span className="marker rail__marker" aria-hidden="true" />
          {TABS.filter((t) => !(inAnkiMode && t.id === "review")).map((t) => (
            <button
              key={t.id}
              className="rail__tab"
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              <span className="rail__icon" aria-hidden="true">
                <Icon name={t.icon} size={22} />
              </span>
              <span className="rail__label">{t.label}</span>
              {t.id === "review" && today.queue.length > 0 && (
                <span className="rail__due">
                  {today.queue.length}
                  <span className="sr-only"> to review</span>
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="app__side">
          {install && (
            <button className="icon-btn" aria-label="Install Mimitori as an app" title="Install Mimitori as an app" onClick={install}>
              <Icon name="download" size={19} />
            </button>
          )}
          <button
            className="icon-btn app__theme"
            aria-label={dark ? "Switch to light" : "Switch to dark"}
            title={dark ? "Switch to light" : "Switch to dark"}
            onClick={() => setSettings({ theme: dark ? "light" : "dark" })}
          >
            <Icon key={dark ? "sun" : "moon"} name={dark ? "sun" : "moon"} size={19} />
          </button>
          <button
            className="icon-btn"
            aria-label={tab === "settings" ? `Close settings, back to ${backLabel}` : "Settings"}
            aria-current={tab === "settings" ? "page" : undefined}
            onClick={openSettings}
          >
            <Icon name="settings" size={20} />
          </button>
        </div>
      </header>

      <main className="app__main">
        {/* Read and Watch stay mounted so pasted text and the video keep their place. */}
        <div hidden={tab !== "read"}>
          <ReadView onOpenSettings={openSettings} />
        </div>
        <div hidden={tab !== "watch"}>
          <WatchView active={tab === "watch"} onOpenSettings={openSettings} />
        </div>
        {tab === "settings" && <SettingsView active backLabel={backLabel} onBack={() => setTab(prevTab)} />}
        {tab === "review" && !inAnkiMode && <ReviewView onGoRead={() => setTab("read")} onGoWatch={() => setTab("watch")} />}
        {tab === "words" && <WordsView onGoWatch={() => setTab("watch")} onGoRead={() => setTab("read")} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
