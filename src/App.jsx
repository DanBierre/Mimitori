import { useState } from "react";
import { StoreProvider, useDueWords, useStore } from "./lib/store";
import ReadView from "./components/ReadView";
import WatchView from "./components/WatchView";
import ReviewView from "./components/ReviewView";
import WordsView from "./components/WordsView";
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
  const knownCount = Object.keys(state.known).length;

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">
          Nihongo Reader
        </h1>
        <p className="app__known">{knownCount} known</p>
      </header>

      <nav className="rail" aria-label="Sections">
        {TABS.map((t) => (
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
        {tab === "review" && <ReviewView onGoRead={() => setTab("read")} />}
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
