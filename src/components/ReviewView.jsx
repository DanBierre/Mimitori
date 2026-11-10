import { useCallback, useEffect, useState } from "react";
import { useDueWords, useStore } from "../lib/store";
import { previewIntervals, Rating } from "../lib/srs";
import { GradeMark } from "./Marks";

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

export default function ReviewView({ onGoRead }) {
  const { state, grade } = useStore();
  const due = useDueWords();

  const [phase, setPhase] = useState("idle"); // idle | running | done
  const [queue, setQueue] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const currentBase = queue[0];
  const word = currentBase ? state.words[currentBase] : null;

  function begin() {
    setQueue(due.map((w) => w.base));
    setReviewed(0);
    setRevealed(false);
    setPhase("running");
  }

  const answer = useCallback(
    (rating) => {
      if (!currentBase) return;
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
    [currentBase, grade]
  );

  useEffect(() => {
    if (phase !== "running") return;
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        answer(Number(e.key));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, revealed, answer]);

  const totalWords = Object.keys(state.words).length;

  if (phase === "running" && word) {
    const intervals = previewIntervals(word.card);
    return (
      <section className="sheet review" aria-label="Review">
        <p className="review__progress">
          {reviewed} done · {queue.length} left
        </p>

        <div className="review__face">
          <p className="review__term" lang="ja">
            {word.base}
          </p>
          {!revealed && word.sentence && (
            <p className="review__sentence" lang="ja">
              <SentenceWithWord sentence={word.sentence} surface={word.surface} base={word.base} />
            </p>
          )}
          {revealed && (
            <div className="review__answer">
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
              <button key={rating} className="grade" onClick={() => answer(rating)}>
                <GradeMark rating={rating} />
                <span className="grade__label">{label}</span>
                <span className="grade__interval">{intervals[rating]}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (phase === "done") {
    return (
      <section className="sheet review review--center" aria-label="Review finished">
        <p className="review__big">Done</p>
        <p className="review__sub">{reviewed} {reviewed === 1 ? "review" : "reviews"}. Words you keep getting right fade from the page on their own.</p>
        <button className="btn btn--primary" onClick={onGoRead}>
          Read something new
        </button>
      </section>
    );
  }

  return (
    <section className="sheet review review--center" aria-label="Review">
      {due.length > 0 ? (
        <>
          <p className="review__big">
            <span className="review__count">{due.length}</span>
            <span className="review__unit">due</span>
          </p>
          <button className="btn btn--primary btn--wide" onClick={begin}>
            Review {due.length} {due.length === 1 ? "word" : "words"}
          </button>
        </>
      ) : totalWords > 0 ? (
        <>
          <p className="review__big">All caught up</p>
          <p className="review__sub">Nothing is due. {totalWords} saved {totalWords === 1 ? "word" : "words"} are scheduled.</p>
          <button className="btn" onClick={onGoRead}>
            Read more
          </button>
        </>
      ) : (
        <>
          <p className="review__big">No words yet</p>
          <p className="review__sub">Read some Japanese, tap a word, and choose “Save to review”. It appears here.</p>
          <button className="btn btn--primary" onClick={onGoRead}>
            Go read
          </button>
        </>
      )}
    </section>
  );
}
