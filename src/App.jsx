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
import "./App.css";

const TABS = [
  { id: "read", label: "Read", icon: "read" },
  { id: "watch", label: "Watch", icon: "watch" },
  { id: "review", label: "Review", icon: "review" },
  { id: "words", label: "Words", icon: "words" },
];

const flags = createFlags();

function Shell() {
  // First visit lands on Watch, where the sample clip is one tap away. After that, Read as before.
  const [tab, setTab] = useState(() => (flags.has("visited") ? "read" : "watch"));
  useEffect(() => flags.set("visited"), []);
  const railRef = useMarker('[aria-current="page"] .rail__label');
  const today = useReviewToday();
  const { state } = useStore();
  const inAnkiMode = ankiMode(state);
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
          <button
            className="icon-btn"
            aria-label="Settings"
            aria-current={tab === "settings" ? "page" : undefined}
            onClick={() => setTab("settings")}
          >
            <Icon name="settings" size={20} />
          </button>
        </div>
      </header>

      <main className="app__main">
        {/* Read and Watch stay mounted so pasted text and the video keep their place. */}
        <div hidden={tab !== "read"}>
          <ReadView onOpenSettings={() => setTab("settings")} />
        </div>
        <div hidden={tab !== "watch"}>
          <WatchView active={tab === "watch"} onOpenSettings={() => setTab("settings")} />
        </div>
        {tab === "settings" && <SettingsView active />}
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
