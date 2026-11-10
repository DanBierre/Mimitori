import { useState } from "react";
import { StoreProvider, useDueWords, useStore } from "./lib/store";
import ReadView from "./components/ReadView";
import ReviewView from "./components/ReviewView";
import WordsView from "./components/WordsView";
import { Seal } from "./components/Marks";
import "./App.css";

const TABS = [
  { id: "read", kanji: "読む", label: "Read" },
  { id: "review", kanji: "復習", label: "Review" },
  { id: "words", kanji: "単語", label: "Words" },
];

function Shell() {
  const [tab, setTab] = useState("read");
  const due = useDueWords();
  const { state } = useStore();
  const knownCount = Object.keys(state.known).length;

  return (
    <div className="app">
      <header className="app__header">
        <Seal />
        <h1 className="app__title">Nihongo Reader</h1>
        <p className="app__known">{knownCount} known</p>
      </header>

      <main className="app__main">
        {/* Read stays mounted so pasted text and lookups survive tab switches. */}
        <div hidden={tab !== "read"}>
          <ReadView />
        </div>
        {tab === "review" && <ReviewView onGoRead={() => setTab("read")} />}
        {tab === "words" && <WordsView />}
      </main>

      <nav className="rail" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="rail__tab"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="rail__kanji" lang="ja">
              {t.kanji}
            </span>
            <span className="rail__label">{t.label}</span>
            {t.id === "review" && due.length > 0 && <span className="rail__badge">{due.length}</span>}
          </button>
        ))}
      </nav>
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
