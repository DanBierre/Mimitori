import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { tokenizeWithReadings, JAPANESE_REGEX } from "../lib/furigana";
import { translateText, translationEnabled } from "../lib/translate";
import { useStore } from "../lib/store";
import TokenLine from "./TokenLine";
import { useMarker } from "../lib/useMarker";
import { conjugationParts } from "../lib/conjugation";
import { canSpeak, speak } from "../lib/speak";
import WordPanel from "./WordPanel";
import { sentenceAround, sentenceContext } from "../lib/sentence";
import { loadBookRecents, saveBookRecents, coverKey } from "../lib/book/recents";
import { upsertRecent, droppedKeys } from "../lib/recents";
import { putImage, getImageUrl, deleteImage } from "../lib/images";
// The viewer, pdf.js and the book code load only when a book opens.
const BookView = lazy(() => import("./BookView"));

const SAMPLE =
  "今日は友達と一緒に日本語を勉強します。難しい漢字がたくさんありますが、毎日少しずつ読むと、だんだん分かるようになります。";

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

export default function ReadView({ onOpenSettings }) {
  const { state, setSettings } = useStore();
  const { furigana, size } = state.settings;
  const furiRef = useMarker('[aria-pressed="true"]');

  const [input, setInput] = useState("");
  const [tokens, setTokens] = useState(null);
  const [translation, setTranslation] = useState({ status: "idle", text: "", error: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null); // token index

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
    const files = [...list];
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
    const patch = { key: book.key, name: book.title, page, pageCount: book.pageCount };
    const prev = recentsRef.current;
    const next = upsertRecent(prev, patch);
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
    if (!text) return;
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
  }

  const selectedToken = tokens && selected !== null ? tokens[selected] : null;
  const panelOpen = Boolean(selectedToken);

  if (book) {
    return (
      <Suspense fallback={<p className="note">Opening…</p>}>
        <BookView book={book} onClose={closeBook} onOpenSettings={onOpenSettings} onPage={savePage} />
      </Suspense>
    );
  }

  return (
    <div
      className={`read ${panelOpen ? "read--panel-open" : ""}${dropping ? " read--drop" : ""}`}
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
        openFiles(e.dataTransfer.files);
      }}
    >
      <section className="sheet read__sheet" aria-label="Reading sheet">
        {!tokens ? (
          <div className="read__compose">
            <label className="sheet__label" htmlFor="paste">
              Paste Japanese
            </label>
            <textarea
              id="paste"
              className="read__input"
              lang="ja"
              placeholder="ここに日本語を貼り付けてください"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={7}
            />
            <div className="read__compose-actions">
              <button
                className="btn btn--primary"
                onClick={handleLookup}
                disabled={status === "loading" || !input.trim()}
              >
                {status === "loading" ? "Reading…" : "Read this"}
              </button>
              <button className="btn btn--quiet" onClick={() => setInput(SAMPLE)}>
                Use a sample
              </button>
            </div>
            {status === "error" && (
              <p className="note note--error" role="alert">
                {error}
              </p>
            )}

            <div className="read__open">
              <button className="btn btn--quiet read__edit" onClick={() => fileInput.current.click()} disabled={opening}>
                {opening ? "Opening…" : "Open a PDF, CBZ or folder"}
              </button>
              <button className="link read__edit read__folder" onClick={() => folderInput.current.click()} disabled={opening}>
                Choose a folder
              </button>
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
                <h2 id="book-recents" className="recents__title">
                  Recent books
                </h2>
                <ul className="recents__list">
                  {recents.map((r) => (
                    <li key={r.key} className="recents__row">
                      <Cover id={r.key} />
                      <span className="recents__name" title={r.name}>
                        {r.name}
                      </span>
                      <span className="recents__stop">{r.page && r.pageCount ? `p. ${r.page} of ${r.pageCount}` : ""}</span>
                      <button
                        className="btn btn--quiet recents__go row-action"
                        aria-label={`Carry on with ${r.name}`}
                        onClick={() => fileInput.current.click()}
                      >
                        Carry on
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        ) : (
          <>
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

            <p className="read__text" lang="ja" style={{ "--read-size": `${size}px` }}>
              <TokenLine tokens={tokens} selected={selected} onSelect={setSelected} />
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
                  Say it
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {selectedToken && (
        <WordPanel
          token={selectedToken}
          sentence={sentenceAround(tokens, selected)}
          grammar={conjugationParts(tokens, selected)}
          ankiContext={sentenceContext(tokens, selected)}
          onOpenSettings={onOpenSettings}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
