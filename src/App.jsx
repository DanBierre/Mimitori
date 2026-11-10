import { useState } from "react";
import { StoreProvider, ankiMode, useDueWords, useStore } from "./lib/store";
import { useAnki } from "./lib/anki/useAnki";
import ReadView from "./components/ReadView";
import WatchView from "./components/WatchView";
import ReviewView from "./components/ReviewView";
import WordsView from "./components/WordsView";
import SettingsView from "./components/SettingsView";
import Icon from "./components/Icon";
import "./App.css";

const TABS = [
  { id: "read", label: "Read", icon: "read" },
  { id: "watch", label: "Watch", icon: "watch" },
  { id: "review", label: "Review", icon: "review" },
  { id: "words", label: "Words", icon: "words" },
];

function Shell() {
  const [tab, setTab] = useState("read");
  const due = useDueWords();
  const { state } = useStore();
  const inAnkiMode = ankiMode(state);
  useAnki(inAnkiMode && tab !== "settings"); // keeps known words fresh; Settings runs its own
  const knownCount = Object.keys(state.known).length + Object.keys(state.anki.known).length;

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          Nihongo Reader
        </h1>
        <div className="app__side">
          <p className="app__known">{knownCount} known</p>
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

      <nav className="rail" aria-label="Sections">
        {TABS.filter((t) => !(inAnkiMode && t.id === "review")).map((t) => (
          <button
            key={t.id}
            className="rail__tab"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={22} />
            <span className="rail__label">{t.label}</span>
            {t.id === "review" && due.length > 0 && <span className="rail__badge">{due.length}</span>}
          </button>
        ))}
      </nav>

      <main className="app__main">
        {/* Read and Watch stay mounted so pasted text and the video keep their place. */}
        <div hidden={tab !== "read"}>
          <ReadView />
        </div>
        <div hidden={tab !== "watch"}>
          <WatchView active={tab === "watch"} />
        </div>
        {tab === "settings" && <SettingsView active />}
        {tab === "review" && !inAnkiMode && <ReviewView onGoRead={() => setTab("read")} />}
        {tab === "words" && <WordsView />}
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
