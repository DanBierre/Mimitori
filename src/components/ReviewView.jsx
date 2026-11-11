import { useCallback, useEffect, useRef, useState } from "react";
import { useReviewToday, useStore } from "../lib/store";
import { previewIntervals, Rating } from "../lib/srs";
import SceneStill from "./SceneStill";

const GRADES = [
  [Rating.Again, "Again"],
  [Rating.Hard, "Hard"],
  [Rating.Good, "Good"],
  [Rating.Easy, "Easy"],
];

// Highlights the saved word inside its example sentence.
function SentenceWithWord({ sentence, surface, base }) {
  const needle = sentence.includes(surface) ? surface : sentence.includes(base) ? base : null;
  if (!needle) return <>{sentence}</>;
  const [before, ...rest] = sentence.split(needle);
  return (
    <>
      {before}
      <mark className="review__hit">{needle}</mark>
      {rest.join(needle)}
    </>
  );
}

export default function ReviewView({ onGoRead, onGoWatch }) {
  const { state, grade, restoreWord } = useStore();
  const { queue: due, waiting } = useReviewToday();

  const [phase, setPhase] = useState("idle"); // idle | running | done
  const [queue, setQueue] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [last, setLast] = useState(null); // the step before the last grade, for Undo
  const goodRef = useRef(null);

  const currentBase = queue[0];
  const word = currentBase ? state.words[currentBase] : null;

  function begin() {
    setQueue(due.map((w) => w.base));
    setReviewed(0);
    setRevealed(false);
    setLast(null);
    setPhase("running");
  }

  // Undo the last grade: the word gets its old schedule back and comes round again.
  function undoLast() {
    if (!last) return;
    restoreWord(last.word);
    setQueue(last.queue);
    setReviewed(last.reviewed);
    setRevealed(true);
    setPhase("running");
    setLast(null);
  }

  const answer = useCallback(
    (rating) => {
      if (!currentBase) return;
      setLast({ word: state.words[currentBase], queue, reviewed });
      grade(currentBase, rating);
      setReviewed((n) => n + 1);
      setRevealed(false);
      setQueue((q) => {
        const [head, ...rest] = q;
        const next = rating === Rating.Again ? [...rest, head] : rest;
        if (next.length === 0) setPhase("done");
        return next;
      });
    },
    [currentBase, grade, state.words, queue, reviewed]
  );

  // After the answer shows, focus lands on Good, the usual choice, so the keyboard can carry on.
  useEffect(() => {
    if (revealed) goodRef.current?.focus();
  }, [revealed]);

  useEffect(() => {
    if (phase === "idle") return;
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if ((e.key === "u" || e.key === "U") && !e.ctrlKey && !e.metaKey) return undoLast();
      if (phase !== "running") return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        answer(Number(e.key));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, revealed, answer, last]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalWords = Object.keys(state.words).length;

  if (phase === "running" && word) {
    const intervals = previewIntervals(word.card);
    return (
      <section className="sheet review" aria-label="Review">
        <div className="review__progress">
          <span>
            {reviewed} done · {queue.length} left
          </span>
          <span className="review__bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${reviewed / (reviewed + queue.length)})` }} />
          </span>
          <span className="review__links">
            {last && (
              <button className="link" onClick={undoLast}>
                Undo
              </button>
            )}
            <button className="link" onClick={() => setPhase("done")}>
              End
            </button>
          </span>
        </div>

        <div className="review__face">
          <p className="review__term" lang="ja">
            {word.base}
          </p>
          <SceneStill base={word.base} />
          {!revealed && word.sentence && (
            <p className="review__sentence" lang="ja">
              <SentenceWithWord sentence={word.sentence} surface={word.surface} base={word.base} />
            </p>
          )}
          {revealed && (
            <div className="review__answer" aria-live="polite">
              {word.reading && (
                <p className="review__reading" lang="ja">
                  {word.reading}
                </p>
              )}
              {word.glosses.length > 0 ? (
                <p className="review__meaning">{word.glosses.join("; ")}</p>
              ) : (
                <p className="note">No meaning saved for this word.</p>
              )}
              {word.sentence && (
                <p className="review__sentence" lang="ja">
                  <SentenceWithWord sentence={word.sentence} surface={word.surface} base={word.base} />
                </p>
              )}
            </div>
          )}
        </div>

        {!revealed ? (
          <button className="btn btn--primary btn--wide" onClick={() => setRevealed(true)}>
            Show answer
          </button>
        ) : (
          <div className="grades" role="group" aria-label="How well did you remember it?">
            {GRADES.map(([rating, label]) => (
              <button
                key={rating}
                ref={rating === Rating.Good ? goodRef : undefined}
                className={`grade grade--${rating}`}
                aria-label={`${label}, next in ${intervals[rating]}`}
                onClick={() => answer(rating)}
              >
                <span className="grade__label">
                  {label} <kbd>{rating}</kbd>
                </span>
                <span className="grade__interval">{intervals[rating]}</span>
              </button>
            ))}
          </div>
        )}
        <p className="review__keys only-fine">
          {revealed ? "1–4 to answer · U to undo" : "Space shows the answer"}
        </p>
      </section>
    );
  }

  if (phase === "done") {
    return (
      <section className="sheet review review--center" aria-label="Review finished">
        <p className="review__big">Done</p>
        <p className="review__sub">{reviewed} {reviewed === 1 ? "review" : "reviews"}. Words you keep getting right fade from the page on their own.</p>
        <div className="review__actions">
          <button className="btn btn--primary" onClick={onGoRead}>
            Read something new
          </button>
          {last && (
            <button className="btn btn--quiet" onClick={undoLast}>
              Undo last answer
            </button>
          )}
          {due.length > 0 && (
            <button className="btn btn--quiet" onClick={begin}>
              Keep going ({due.length} left)
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="sheet review review--center" aria-label="Review">
      {due.length > 0 ? (
        <>
          <p className="review__big">
            <span className="review__count">{due.length}</span>
            <span className="review__unit">to review today.</span>
          </p>
          {waiting > 0 && <p className="review__sub">The other {waiting} can wait.</p>}
          <button className="btn btn--primary btn--wide" onClick={begin}>
            Review {due.length} {due.length === 1 ? "word" : "words"}
          </button>
        </>
      ) : totalWords > 0 ? (
        <>
          <p className="review__big">Nothing to review today.</p>
          <p className="review__sub">
            {waiting > 0
              ? `The other ${waiting} can wait.`
              : `${totalWords} saved ${totalWords === 1 ? "word is" : "words are"} scheduled.`}
          </p>
          <button className="btn" onClick={onGoRead}>
            Read more
          </button>
        </>
      ) : (
        <>
          <p className="review__big">Review is empty</p>
          <p className="review__sub">
            Words you save in Read or Watch show up here, spaced so you see each one just before you'd forget it.
            Tap a word and choose “Save to review”.
          </p>
          <div className="review__actions">
            <button className="btn btn--primary" onClick={onGoRead}>Open Read</button>
            <button className="btn btn--quiet" onClick={onGoWatch}>Open Watch</button>
          </div>
        </>
      )}
    </section>
  );
}
