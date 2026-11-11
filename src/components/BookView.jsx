import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { tokenizeWithReadings } from "../lib/furigana";
import { sentenceAround, sentenceContext } from "../lib/sentence";
import { conjugationParts } from "../lib/conjugation";
import { canSpeak, speak } from "../lib/speak";
import { putImage } from "../lib/images";
import { formatPageSource } from "../lib/anki/format";
import { textInBox } from "../lib/book/textInBox";
import { cropForOcr, cropPicture } from "../lib/book/crop";
import { openBooks, emptyRecord, addLine, updateLine, removeLine } from "../lib/book/store";
import { useOcr } from "../lib/book/useOcr";
import { OCR_SIZE_MB } from "../lib/book/ocr";
import TokenLine from "./TokenLine";
import WordPanel from "./WordPanel";
import PageCanvas from "./PageCanvas";
import PageLines from "./PageLines";

const SLOW_MS = 10000;
const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

// Copy for each OCR failure, from the spec's Errors table.
const OCR_ERRORS = {
  "model-download": "Couldn't download the reader. Check your connection.",
  storage: "Not enough space to save the reader. Free some disk space and try again.",
};
const ocrError = (code) => OCR_ERRORS[code] || "Couldn't read that. Try a tighter box.";

// The book viewer: toolbar, the page with its boxes, and a side column with this page's lines and the word card.
// ReadView closes the book (book.close()) when onClose runs.
export default function BookView({ book, onClose, onOpenSettings, onPage }) {
  const { state } = useStore();
  const ocr = useOcr();
  const store = useMemo(() => openBooks(), []);

  const [rec, setRec] = useState(null);
  const recRef = useRef(null);
  const [pageData, setPageData] = useState(null);
  const [pageError, setPageError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [boxing, setBoxing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [float, setFloat] = useState(null); // null | { phase: "wait" | "reading" | "line" | "empty" | "error", box, ... }
  const [editing, setEditing] = useState(null); // { id, text } while Fix text is open
  const [sel, setSel] = useState(null); // { lineId, tokenIndex }
  const [tokensByText, setTokensByText] = useState({});
  const [picture, setPicture] = useState(null);
  const waiting = useRef(null); // a box waiting for the reader to download: { box, page, src }
  const boxedPageRef = useRef(1); // the page the active box was drawn on
  const [typed, setTyped] = useState("");
  const activeBox = useRef(null); // the box the float is about; an answer for any other box is saved but not shown

  // The saved record: page, direction, fit and lines. The first render waits for it.
  useEffect(() => {
    let live = true;
    store.getBook(book.key).then((saved) => {
      if (!live) return;
      const r = saved ?? emptyRecord(book.rtl);
      recRef.current = r;
      setRec(r);
    });
    return () => {
      live = false;
    };
  }, [store, book]);

  const update = useCallback(
    (fn) => {
      const next = fn(recRef.current);
      recRef.current = next;
      setRec(next);
      store.putBook(book.key, next);
    },
    [store, book],
  );

  const page = rec ? Math.min(Math.max(1, rec.page), book.pageCount) : 1;
  const rtl = rec?.rtl ?? book.rtl;
  const fit = rec?.fit ?? "height";
  const lines = rec?.lines[page] ?? [];

  useEffect(() => {
    if (rec) onPage?.(page);
  }, [rec ? page : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the page being shown.
  useEffect(() => {
    if (!rec) return;
    let live = true;
    setPageData(null);
    setPageError(false);
    book
      .getPage(page)
      .then((p) => live && setPageData(p))
      .catch(() => live && setPageError(true));
    return () => {
      live = false;
    };
  }, [book, rec ? page : 0, retry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Image books read with OCR: start loading the reader once the learner has said OK.
  useEffect(() => {
    if (book.kind !== "pdf") ocr.load();
  }, [book, ocr.load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tokenize the lines on this page (once per text).
  useEffect(() => {
    let live = true;
    for (const l of lines) {
      if (tokensByText[l.text]) continue;
      tokenizeWithReadings(l.text)
        .then((t) => live && setTokensByText((m) => (m[l.text] ? m : { ...m, [l.text]: t })))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [lines, tokensByText]);
  const tokensById = {};
  for (const l of lines) if (tokensByText[l.text]) tokensById[l.id] = tokensByText[l.text];

  const selLine = sel && lines.find((l) => l.id === sel.lineId);
  const selTokens = selLine && tokensById[selLine.id];
  const selToken = selTokens?.[sel.tokenIndex];

  // The card picture: the bubble plus a margin, made ahead so it's ready when the learner adds the card.
  useEffect(() => {
    setPicture(null);
    if (!selLine || !pageData) return;
    let live = true;
    cropPicture(pageData.source, pageData.width, pageData.height, selLine.box)
      .then((b) => live && setPicture(b))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [selLine?.id, pageData]); // eslint-disable-line react-hooks/exhaustive-deps

  function go(delta) {
    const next = Math.min(Math.max(1, page + delta), book.pageCount);
    if (next === page) return;
    waiting.current = null;
    activeBox.current = null;
    setFloat(null);
    setEditing(null);
    setCurrentId(null);
    setSel(null);
    update((r) => ({ ...r, page: next }));
  }

  // Saves a line to the page it was boxed on, which may not be the page showing by now.
  function finish(text, from, box, boxedPage, fixed = false) {
    const clean = text.trim();
    if (!clean) {
      setFloat((f) => (f && f.box === box ? { phase: "empty", box } : f));
      return;
    }
    const line = { id: newId(), box, text: clean, from, fixed };
    update((r) => addLine(r, boxedPage, line));
    if (boxedPage === recRef.current.page && activeBox.current === box) {
      setCurrentId(line.id);
      setFloat({ phase: "line", box, lineId: line.id });
    }
  }

  async function readWithOcr(src, box, boxedPage) {
    const timer = setTimeout(() => setFloat((f) => (f && f.box === box && f.phase === "reading" ? { ...f, slow: true } : f)), SLOW_MS);
    try {
      const bitmap = await cropForOcr(src.source, src.width, src.height, box);
      finish(await ocr.read(bitmap), "ocr", box, boxedPage);
    } catch (e) {
      setFloat((f) => (f && f.box === box ? { phase: "error", box, code: e?.code, src, boxedPage } : f));
    } finally {
      clearTimeout(timer);
    }
  }

  function startOcr(src, box, boxedPage) {
    if (ocr.status !== "ready") {
      waiting.current = { src, box, page: boxedPage };
      setFloat({ phase: "wait", box });
      ocr.load();
      return;
    }
    setFloat({ phase: "reading", box });
    readWithOcr(src, box, boxedPage);
  }

  async function onBox(box) {
    const boxedPage = page; // the page the box was drawn on, whatever page is showing when the answer comes back
    const src = pageData;
    if (!src) return;
    activeBox.current = box;
    boxedPageRef.current = boxedPage;
    setCurrentId(null);
    setEditing(null);
    setSel(null);
    waiting.current = null;
    setFloat({ phase: "reading", box });
    let items = null;
    try {
      items = await book.getTextItems(boxedPage);
    } catch {
      /* no text layer to read: fall back to OCR */
    }
    if (activeBox.current !== box) return; // the learner moved on while the text layer loaded
    const text = items ? textInBox(items, box) : "";
    if (text) finish(text, "pdf", box, boxedPage);
    else startOcr(src, box, boxedPage);
  }

  // The reader finished loading while a box was waiting: read it now.
  useEffect(() => {
    if (ocr.status === "ready" && waiting.current) {
      const { src, box, page: boxedPage } = waiting.current;
      waiting.current = null;
      setFloat({ phase: "reading", box });
      readWithOcr(src, box, boxedPage);
    }
  }, [ocr.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keys: arrows turn pages (following the direction), B toggles boxing, Esc closes the float.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowLeft") go(rtl ? 1 : -1);
      else if (e.key === "ArrowRight") go(rtl ? -1 : 1);
      else if (e.key === "b" || e.key === "B") setBoxing((b) => !b);
      else if (e.key === "Escape") {
        waiting.current = null;
        activeBox.current = null;
        setFloat(null);
        setEditing(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pick = (id) => {
    const l = lines.find((x) => x.id === id);
    if (!l) return;
    activeBox.current = l.box;
    setCurrentId(id);
    setSel(null);
    setEditing(null);
    setFloat({ phase: "line", box: l.box, lineId: id });
  };

  const selectWord = (lineId, tokenIndex) => {
    setCurrentId(lineId);
    setSel(tokenIndex === null ? null : { lineId, tokenIndex });
  };

  // The reader may be missing (offline, or never allowed), so the learner can always type the line.
  const typeButton = float && (
    <button
      className="btn btn--quiet book__type"
      onClick={() => {
        waiting.current = null;
        setTyped("");
        setFloat({ phase: "type", box: float.box });
      }}
    >
      Type it instead
    </button>
  );

  // ----- the float beside the boxed bubble -----
  let floatNode = null;
  if (float) {
    const line = float.phase === "line" ? lines.find((l) => l.id === float.lineId) : null;
    if (float.phase === "reading") {
      floatNode = (
        <>
          <p className="book__float-note">Reading…</p>
          {float.slow && <p className="book__float-note">This browser is slow at reading bubbles.</p>}
        </>
      );
    } else if (float.phase === "wait") {
      floatNode = ocr.status === "needs-ok" ? (
        <>
          <p className="book__float-note">
            Reading bubbles needs a one-off download, about {OCR_SIZE_MB} MB. It then works offline.
          </p>
          <button className="btn btn--primary" onClick={ocr.allowDownload}>
            Download
          </button>
          {typeButton}
        </>
      ) : ocr.status === "error" ? (
        <>
          <p className="book__float-note note--error">{ocrError(ocr.error?.code || "model-download")}</p>
          <button className="btn" onClick={ocr.allowDownload}>
            Retry
          </button>
          {typeButton}
        </>
      ) : (
        <>
          <p className="book__float-note">Getting the reader… {ocr.modelPct}%</p>
          <progress className="book__progress" max="100" value={ocr.modelPct} />
          {typeButton}
        </>
      );
    } else if (float.phase === "type") {
      floatNode = (
        <form
          className="book__fix"
          onSubmit={(e) => {
            e.preventDefault();
            finish(typed, "ocr", float.box, boxedPageRef.current, true);
          }}
        >
          <input
            className="book__fix-input"
            lang="ja"
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label="Type the line"
          />
          <button className="btn btn--primary" type="submit">
            Save
          </button>
          <button className="btn btn--quiet" type="button" onClick={() => setFloat(null)}>
            Cancel
          </button>
        </form>
      );
    } else if (float.phase === "empty") {
      floatNode = (
        <>
          <p className="book__float-note">Couldn't read that. Try a tighter box.</p>
          {typeButton}
        </>
      );
    } else if (float.phase === "error") {
      floatNode = (
        <>
          <p className="book__float-note note--error">{ocrError(float.code)}</p>
          {(float.code === "model-download" || float.code === "storage") && (
            <button
              className="btn"
              onClick={() => {
                waiting.current = { src: float.src, box: float.box, page: float.boxedPage };
                setFloat({ phase: "wait", box: float.box });
                ocr.allowDownload();
              }}
            >
              Retry
            </button>
          )}
          {typeButton}
        </>
      );
    } else if (line) {
      floatNode =
        editing?.id === line.id ? (
          <form
            className="book__fix"
            onSubmit={(e) => {
              e.preventDefault();
              const text = editing.text.trim();
              if (text) update((r) => updateLine(r, page, line.id, text));
              setEditing(null);
            }}
          >
            <input
              className="book__fix-input"
              lang="ja"
              autoFocus
              value={editing.text}
              onChange={(e) => setEditing({ id: line.id, text: e.target.value })}
              aria-label="Line text"
            />
            <button className="btn btn--primary" type="submit">
              Save
            </button>
            <button className="btn btn--quiet" type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <p className="book__float-line" lang="ja" style={{ "--read-size": `${Math.min(state.settings.size, 28)}px` }}>
              {tokensById[line.id] ? (
                <TokenLine
                  tokens={tokensById[line.id]}
                  selected={sel?.lineId === line.id ? sel.tokenIndex : null}
                  onSelect={(i) => selectWord(line.id, i)}
                />
              ) : (
                line.text
              )}
            </p>
            <div className="book__float-actions">
              <button className="btn btn--quiet" onClick={() => setEditing({ id: line.id, text: line.text })}>
                Fix text
              </button>
              <button className="btn btn--quiet" onClick={() => navigator.clipboard?.writeText(line.text).catch(() => {})}>
                Copy
              </button>
              {canSpeak() && (
                <button className="btn btn--quiet" onClick={() => speak(line.text)}>
                  Say it
                </button>
              )}
            </div>
          </>
        );
    }
  }

  if (!rec) return <p className="note">Opening…</p>;

  const pending = float && float.phase !== "line" && float.phase !== "empty" ? float.box : null;
  const forward = rtl ? "←" : "→";
  const backward = rtl ? "→" : "←";

  return (
    <div className="book">
      <div className="book__bar">
        <h2 className="book__title" title={book.title}>
          {book.title}
        </h2>
        <div className="book__tools">
          <button className="btn btn--quiet" aria-pressed={boxing} onClick={() => setBoxing((b) => !b)}>
            Box a line <kbd>B</kbd>
          </button>
          <div className="segmented" role="group" aria-label="Reading direction">
            <button className="segmented__btn" aria-pressed={rtl} onClick={() => update((r) => ({ ...r, rtl: true }))}>
              Right to left
            </button>
            <button className="segmented__btn" aria-pressed={!rtl} onClick={() => update((r) => ({ ...r, rtl: false }))}>
              Left to right
            </button>
          </div>
          <div className="segmented" role="group" aria-label="Fit">
            <button className="segmented__btn" aria-pressed={fit === "height"} onClick={() => update((r) => ({ ...r, fit: "height" }))}>
              Fit height
            </button>
            <button className="segmented__btn" aria-pressed={fit === "width"} onClick={() => update((r) => ({ ...r, fit: "width" }))}>
              Fit width
            </button>
          </div>
        </div>
        <div className="book__nav">
          <div className="book__pager" data-rtl={rtl || undefined}>
            <button className="icon-btn" aria-label="Previous page" onClick={() => go(-1)} disabled={page <= 1}>
              {backward}
            </button>
            <span className="book__count">
              {page} / {book.pageCount}
            </span>
            <button className="icon-btn" aria-label="Next page" onClick={() => go(1)} disabled={page >= book.pageCount}>
              {forward}
            </button>
          </div>
          <button className="btn btn--quiet" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className="book__body">
        <div className="book__page">
          {pageError ? (
            <div className="book__fail">
              <p>This page didn't load.</p>
              <button className="btn" onClick={() => setRetry((n) => n + 1)}>
                Try again
              </button>
            </div>
          ) : !pageData ? (
            <p className="note">Loading page…</p>
          ) : (
            <PageCanvas
              page={pageData}
              lines={lines}
              currentId={currentId}
              boxing={boxing}
              fit={fit}
              pending={pending}
              floatBox={float?.box}
              onBox={onBox}
              onPick={pick}
              float={floatNode}
            />
          )}
        </div>
        <aside className="book__side" aria-label="On this page">
          <h3 className="book__side-title">On this page</h3>
          <PageLines
            lines={lines}
            tokensById={tokensById}
            currentId={currentId}
            selected={sel}
            onSelect={selectWord}
            onPick={pick}
          />
          {selToken && (
            <WordPanel
              token={selToken}
              sentence={sentenceAround(selTokens, sel.tokenIndex)}
              grammar={conjugationParts(selTokens, sel.tokenIndex)}
              ankiContext={{
                ...sentenceContext(selTokens, sel.tokenIndex),
                picture: picture || undefined,
                source: formatPageSource(book.title, page),
              }}
              onSaved={(base) => picture && putImage(base, picture)}
              onOpenSettings={onOpenSettings}
              onClose={() => setSel(null)}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
