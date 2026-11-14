import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { tokenizeWithReadings, JAPANESE_REGEX } from "../lib/furigana";
import { translateText, translationEnabled } from "../lib/translate";
import { ankiMode, useStore, wordState } from "../lib/store";
import TokenLine from "./TokenLine";
import { useMarker } from "../lib/useMarker";
import { conjugationParts } from "../lib/conjugation";
import { canSpeak, speak } from "../lib/speak";
import WordPanel from "./WordPanel";
import { sentenceAround, sentenceContext } from "../lib/sentence";
import { loadBookRecents, saveBookRecents, coverKey } from "../lib/book/recents";
import { upsertRecent, droppedKeys } from "../lib/recents";
import Icon from "./Icon";
import { putImage, getImageUrl, deleteImage } from "../lib/images";
import { createFlags } from "../lib/firstRun";
import { filesFromDrop, pickBookFiles } from "../lib/book/drop";
import { SAMPLES } from "../lib/samples";
// The viewer, pdf.js and the book code load only when a book opens.
const BookView = lazy(() => import("./BookView"));

// A different passage each press.
const pickSample = (current) => {
  const rest = SAMPLES.filter((t) => t !== current);
  return rest[Math.floor(Math.random() * rest.length)];
};

const flags = createFlags();
const MOD_KEY = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";

const FURIGANA_MODES = [
  ["unknown", "New words"],
  ["all", "All"],
  ["off", "Off"],
];

const BOOK_ERRORS = {
  unsupported: "Mimitori can't open this kind of file yet. Save it as CBZ, or as a PDF without a password.",
  password: "Mimitori can't open this kind of file yet. Save it as CBZ, or as a PDF without a password.",
  "no-pages": "No pages found in this file.",
  broken: "No pages found in this file.",
};

// A recent book's cover, loaded after the row shows.
function Cover({ id }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url = null;
    let off = false;
    getImageUrl(coverKey(id)).then((u) => {
      url = u;
      if (off && u) URL.revokeObjectURL(u);
      else if (u) setSrc(u);
    });
    return () => {
      off = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return <span className="recents__thumb">{src && <img src={src} alt="" loading="lazy" decoding="async" />}</span>;
}

// A manga page with one speech bubble boxed, the way a reader picks a line to read.
function BookFigure() {
  return (
    <svg className="read__figure" viewBox="0 0 128 176" width="96" height="132" aria-hidden="true">
      <rect className="read__figure-paper" x="0.5" y="0.5" width="127" height="175" />
      <path d="M10 10h108v62H10zM10 80h50v86H10zM68 80h50v40H68zM68 128h50v38H68z" />
      <ellipse className="read__figure-bub" cx="88" cy="32" rx="17" ry="13" />
      <ellipse className="read__figure-bub" cx="35" cy="104" rx="13" ry="16" />
      <path className="read__figure-text" d="M96 18v28M90 20v24M84 22v18" />
      <rect className="read__figure-box" x="66" y="14" width="42" height="36" />
    </svg>
  );
}

export default function ReadView({ onOpenSettings }) {
  const { state, setSettings } = useStore();
  const { furigana, size } = state.settings;
  const furiRef = useMarker('[aria-pressed="true"]');

  // The draft survives a reload (pasted text is the learner's work).
  const [input, setInputState] = useState(() => {
    try {
      return localStorage.getItem("mimitori:read-draft") || "";
    } catch {
      return "";
    }
  });
  const setInput = (v) => {
    setInputState(v);
    try {
      localStorage.setItem("mimitori:read-draft", v);
    } catch {
      /* the draft just won't survive a reload */
    }
  };
  const [tokens, setTokens] = useState(null);
  const [translation, setTranslation] = useState({ status: "idle", text: "", error: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null); // token index
  const [tip, setTip] = useState(() => !flags.has("read-tip")); // one-off "tap a word" hint
  const pasteRef = useRef(null);

  function selectWord(i) {
    setSelected(i);
    if (tip && i !== null) {
      flags.set("read-tip");
      setTip(false);
    }
    // Phones and tablets: the word card is a sheet over the bottom of the screen, so lift the word above it.
    if (i !== null && window.innerWidth < 1100) {
      requestAnimationFrame(() => {
        const el = document.querySelector(".read__text .word[aria-pressed='true']");
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        const want = window.innerHeight * 0.22;
        if (top > window.innerHeight * 0.38 || top < 60) window.scrollBy({ top: top - want, behavior: "smooth" });
      });
    }
  }

  // Closing the card puts focus back on the word it came from.
  function closeCard() {
    document.querySelector(".read__text .word[aria-pressed='true']")?.focus();
    setSelected(null);
  }

  // Books: PDFs, CBZ files and image folders open in BookView in place of the sheet.
  const [book, setBook] = useState(null);
  const [opening, setOpening] = useState(false);
  const [bookError, setBookError] = useState("");
  const [dropping, setDropping] = useState(false);
  const [recents, setRecents] = useState(loadBookRecents);
  const recentsRef = useRef(recents);
  const bookRef = useRef(null);
  const fileInput = useRef(null);
  const folderInput = useRef(null);
  bookRef.current = book;
  useEffect(() => () => bookRef.current?.close(), []);

  async function openFiles(list) {
    const files = pickBookFiles([...list]);
    if (!files.length || opening) return;
    setOpening(true);
    setBookError("");
    try {
      const { openBook } = await import("../lib/book/open");
      const next = await openBook(files);
      const first = !recentsRef.current.some((r) => r.key === next.key);
      setBook(next);
      if (first) {
        // a small cover from page 1; a failure just leaves the row without one
        const { cropPicture } = await import("../lib/book/crop");
        // peekPage decodes on the side, so it can't close the page BookView is showing
        next
          .peekPage(1)
          .then(async (p) => {
            try {
              await putImage(coverKey(next.key), await cropPicture(p.source, p.width, p.height, [0, 0, 1, 1], 192));
            } finally {
              p.source.close?.();
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      setBookError(BOOK_ERRORS[e?.code] || BOOK_ERRORS.broken);
    } finally {
      setOpening(false);
    }
  }

  function savePage(page) {
    setBookRecents(upsertRecent(recentsRef.current, { key: book.key, name: book.title, page, pageCount: book.pageCount }));
  }

  // Drops a book from "Carry on reading", cover and all. The file itself was never kept.
  const removeRecent = (key) => setBookRecents(recentsRef.current.filter((r) => r.key !== key));

  function setBookRecents(next) {
    const prev = recentsRef.current;
    for (const k of droppedKeys(prev, next)) deleteImage(coverKey(k));
    recentsRef.current = next;
    setRecents(next);
    saveBookRecents(next);
  }

  function closeBook() {
    book.close();
    setBook(null);
  }

  const onPicked = (e) => {
    openFiles(e.target.files);
    e.target.value = ""; // the same file can be picked again
  };

  async function handleLookup() {
    const text = input.trim();
    if (!text) {
      pasteRef.current?.focus();
      return;
    }
    if (!JAPANESE_REGEX.test(text)) {
      setError("That doesn’t look like Japanese. Paste some Japanese text and try again.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setError("");
    setSelected(null);
    setTokens(null);
    if (translationEnabled) {
      setTranslation({ status: "loading", text: "", error: "" });
      translateText(text)
        .then((t) => setTranslation({ status: "ready", text: t, error: "" }))
        .catch((e) => setTranslation({ status: "error", text: "", error: e.message }));
    }

    try {
      setTokens(await tokenizeWithReadings(text));
      setStatus("idle");
    } catch {
      setError("The reading engine didn’t load. Reload the page and try again.");
      setStatus("error");
    }
  }

  function backToEdit() {
    setTokens(null);
    setSelected(null);
    setTimeout(() => pasteRef.current?.focus(), 0);
  }

  const selectedToken = tokens && selected !== null ? tokens[selected] : null;
  const panelOpen = Boolean(selectedToken);

  // How much of this text you already know, and how many different words are new or already kept.
  const stats = useMemo(() => {
    if (!tokens) return null;
    let all = 0;
    let known = 0;
    const fresh = new Set();
    const kept = new Set();
    for (const t of tokens) {
      if (!t.isWord) continue;
      all++;
      const s = wordState(state, t.base);
      if (s === "known") known++;
      else (s === "new" ? fresh : kept).add(t.base);
    }
    return { pct: all ? Math.round((known / all) * 100) : 0, fresh: fresh.size, kept: kept.size };
  }, [tokens, state]);

  if (book) {
    return (
      <Suspense fallback={<p className="note">Opening…</p>}>
        <BookView book={book} onClose={closeBook} onOpenSettings={onOpenSettings} onPage={savePage} />
      </Suspense>
    );
  }

  return (
    <div
      className={`read ${panelOpen ? "read--panel-open" : ""}${tokens ? " read--reading" : ""}${dropping ? " read--drop" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget.contains(e.relatedTarget) || setDropping(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        // a read error here is the disk, not the book
        filesFromDrop(e.dataTransfer).then(openFiles, () => setBookError(BOOK_ERRORS.broken));
      }}
    >
      <section className="sheet read__sheet" aria-label="Reading sheet">
        {!tokens ? (
          <div className="read__compose">
            <h2 className="read__head">Read real Japanese.</h2>
            <p className="read__lede">Open a manga or PDF, or paste any text. Tap a word for its reading and meaning.</p>

            <div className="read__doors">
              <section className="read__door read__door--book" aria-labelledby="door-book">
                <h3 id="door-book" className="read__door-title">
                  A manga or PDF <span className="read__door-tag">CBZ · PDF · pages</span>
                </h3>
                <p className="read__door-hint">Box a speech bubble to read it. Nothing leaves your device.</p>
                <div className="read__drop">
                  <BookFigure />
                  <p className="read__drop-say only-fine" aria-live="polite">
                    {dropping ? "Let go to open it" : "Drop a file or a folder of pages here"}
                  </p>
                  <div className="read__drop-actions">
                    <button className="btn btn--primary" onClick={() => fileInput.current.click()} disabled={opening}>
                      {opening ? "Opening…" : "Choose a file"}
                    </button>
                    <button className="btn only-fine" onClick={() => folderInput.current.click()} disabled={opening}>
                      Folder of pages
                    </button>
                  </div>
                  <input ref={fileInput} type="file" hidden multiple accept=".pdf,.cbz,.zip,image/*" onChange={onPicked} />
                  <input ref={folderInput} type="file" hidden webkitdirectory="" onChange={onPicked} />
                </div>
                {bookError && (
                  <p className="note note--error" role="alert">
                    {bookError}
                  </p>
                )}

                {recents.length > 0 && (
                  <section className="recents recents--books" aria-labelledby="book-recents">
                    <h4 id="book-recents" className="recents__title">
                      Carry on reading
                    </h4>
                    <p className="recents__note">Mimitori never keeps a copy of your files, so pick the same one again to carry on.</p>
                    <ul className="recents__list">
                      {recents.map((r) => (
                        <li key={r.key} className="recents__row">
                          <Cover id={r.key} />
                          <span className="recents__name" title={r.name}>
                            {r.name}
                          </span>
                          <span className="recents__stop">{r.page && r.pageCount ? `p. ${r.page} / ${r.pageCount}` : ""}</span>
                          <button
                            className="btn btn--quiet recents__go row-action"
                            aria-label={`Open ${r.name} again`}
                            onClick={() => fileInput.current.click()}
                          >
                            Open
                          </button>
                          <button
                            className="icon-btn recents__remove row-action"
                            aria-label={`Remove ${r.name} from this list`}
                            title="Remove from this list"
                            onClick={() => removeRecent(r.key)}
                          >
                            <Icon name="close" size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </section>

              <section className="read__door read__door--text" aria-labelledby="door-text">
                <h3 id="door-text" className="read__door-title">
                  Some text <span className="read__door-tag">paste</span>
                </h3>
                <p className="read__door-hint" id="paste-hint">
                  News, a game script, a message from a mate.
                </p>
                <textarea
                  id="paste"
                  ref={pasteRef}
                  className="read__input"
                  lang="ja"
                  aria-label="Japanese text to read"
                  aria-describedby="paste-hint"
                  placeholder="ここに日本語を貼り付けてください"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleLookup();
                    }
                  }}
                  rows={5}
                />
                <div className="read__compose-actions">
                  <button className="btn" onClick={handleLookup} disabled={status === "loading"}>
                    {status === "loading" ? "Reading…" : "Read this"}
                  </button>
                  <button className="btn btn--quiet" onClick={() => setInput(pickSample(input))}>
                    Try a sample
                  </button>
                  {input && (
                    <button
                      className="btn btn--quiet"
                      onClick={() => {
                        setInput("");
                        pasteRef.current?.focus();
                      }}
                    >
                      Clear
                    </button>
                  )}
                  <span className="read__keys" aria-hidden="true">
                    <kbd>{MOD_KEY}</kbd> <kbd>Enter</kbd>
                  </span>
                </div>
                {status === "error" && (
                  <p className="note note--error" role="alert">
                    {error}
                  </p>
                )}
              </section>
            </div>
          </div>
        ) : (
          <>
            <div className="read__stats">
              <div>
                <b>{stats.pct}%</b>
                words you know
                <span className="read__cov" role="img" aria-label={`${stats.pct} percent known`}>
                  <i style={{ width: `${stats.pct}%` }} />
                </span>
              </div>
              <div>
                <b>{stats.fresh}</b>
                new {stats.fresh === 1 ? "word" : "words"}
              </div>
              <div>
                <b>{stats.kept}</b>
                {ankiMode(state) ? "in Anki" : "saved"}
              </div>
            </div>
            <div className="read__toolbar">
              <div className="segmented" role="group" aria-label="Furigana" ref={furiRef}>
                <span className="marker" aria-hidden="true" />
                <span className="segmented__label">Furigana</span>
                {FURIGANA_MODES.map(([value, label]) => (
                  <button
                    key={value}
                    className="segmented__btn"
                    aria-pressed={furigana === value}
                    onClick={() => setSettings({ furigana: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="stepper" role="group" aria-label="Text size">
                <button
                  className="stepper__btn"
                  onClick={() => setSettings({ size: Math.max(18, size - 2) })}
                  aria-label="Smaller text"
                >
                  A−
                </button>
                <button
                  className="stepper__btn stepper__btn--big"
                  onClick={() => setSettings({ size: Math.min(44, size + 2) })}
                  aria-label="Larger text"
                >
                  A+
                </button>
              </div>
            </div>

            {tip && <p className="read__tip">Tap any word to see its reading and meaning.</p>}

            <p className="read__text" lang="ja" style={{ "--read-size": `${size}px` }}>
              <TokenLine tokens={tokens} selected={selected} onSelect={selectWord} />
            </p>

            {translationEnabled && (
            <div className="read__translation">
              {translation.status === "loading" && <p className="note">Translating…</p>}
              {translation.status === "ready" && <p className="read__translation-text">{translation.text}</p>}
              {translation.status === "error" && (
                <p className="note">Translation isn’t available right now. Readings and word lookup still work.</p>
              )}
            </div>
            )}

            <div className="read__after">
              <button className="btn btn--quiet read__edit" onClick={backToEdit}>
                Edit text
              </button>
              {canSpeak() && (
                <button className="btn btn--quiet read__edit" onClick={() => speak(input)}>
                  Read aloud
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {tokens && !selectedToken && (
        <aside className="read__card-hint" aria-hidden="true">
          Tap any word to see its reading and meaning.
        </aside>
      )}
      {selectedToken && (
        <WordPanel
          token={selectedToken}
          sentence={sentenceAround(tokens, selected)}
          grammar={conjugationParts(tokens, selected)}
          ankiContext={sentenceContext(tokens, selected)}
          onOpenSettings={onOpenSettings}
          onClose={closeCard}
        />
      )}
    </div>
  );
}
