import { useCallback, useEffect, useRef, useState } from "react";
import { useReviewToday, useStore, useT } from "../lib/store";
import { previewIntervals, Rating } from "../lib/srs";
import SceneStill from "./SceneStill";
import { weekStats } from "../lib/progress";

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

// One quiet readout line: this week's reviews, saves and known words, plus days in a row.
function WeekLine({ state, t }) {
  const { reviews, saved, learnt, streak } = weekStats(state);
  if (!reviews && !saved && !learnt) return null;
  const part = (n, one, many) => (
    <span>
      <b>{n}</b> {t(n === 1 ? one : many)}
    </span>
  );
  return (
    <p className="review__week" aria-label={t("This week")}>
      <span className="review__week-label">{t("This week")}</span>
      {part(reviews, "review", "reviews")}
      {part(saved, "saved", "saved")}
      {part(learnt, "known", "known")}
      {streak > 1 && part(streak, "day in a row", "days in a row")}
    </p>
  );
}

export default function ReviewView({ onGoRead, onGoWatch }) {
  const { state, grade, restoreWord } = useStore();
  const t = useT();
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
      // Space and Enter on a focused button press that button, not Show answer.
      if (!revealed && (e.key === " " || e.key === "Enter") && e.target.tagName !== "BUTTON") {
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
      <section className="sheet review" aria-label={t("Review")}>
        <div className="review__progress">
          <span>
            {t("{done} done · {left} left", { done: reviewed, left: queue.length })}
          </span>
          <span className="review__bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${reviewed / (reviewed + queue.length)})` }} />
          </span>
          <span className="review__links">
            {last && (
              <button className="link" onClick={undoLast}>
                {t("Undo")}
              </button>
            )}
            <button className="link" onClick={() => setPhase("done")}>
              {t("End")}
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
                <p className="note">{t("No meaning saved for this word.")}</p>
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
            {t("Show answer")}
          </button>
        ) : (
          <>
          <p className="review__ask" id="review-ask">{t("How well did you remember it?")}</p>
          <div className="grades" role="group" aria-labelledby="review-ask">
            {GRADES.map(([rating, label]) => (
              <button
                key={rating}
                ref={rating === Rating.Good ? goodRef : undefined}
                className={`grade grade--${rating}`}
                aria-label={t("{grade}, next in {when}", { grade: t(label), when: t(intervals[rating]) })}
                onClick={() => answer(rating)}
              >
                <span className="grade__label">
                  {t(label)} <kbd>{rating}</kbd>
                </span>
                <span className="grade__interval">{t(intervals[rating])}</span>
              </button>
            ))}
          </div>
          </>
        )}
        <p className="review__keys only-fine">
          {revealed ? t("1–4 to answer · U to undo") : t("Space shows the answer")}
        </p>
      </section>
    );
  }

  if (phase === "done") {
    return (
      <section className="sheet review review--center" aria-label={t("Review finished")}>
        <p className="review__big">{t("Done")}</p>
        <p className="review__sub">{t(reviewed === 1 ? "{n} review. Words you keep getting right fade from the page on their own." : "{n} reviews. Words you keep getting right fade from the page on their own.", { n: reviewed })}</p>
        <div className="review__actions">
          <button className="btn btn--primary" onClick={onGoRead}>
            {t("Read something new")}
          </button>
          {last && (
            <button className="btn btn--quiet" onClick={undoLast}>
              {t("Undo last answer")}
            </button>
          )}
          {due.length > 0 && (
            <button className="btn btn--quiet" onClick={begin}>
              {t("Keep going ({n} left)", { n: due.length })}
            </button>
          )}
        </div>
        <WeekLine state={state} t={t} />
      </section>
    );
  }

  return (
    <section className="sheet review review--center" aria-label={t("Review")}>
      {due.length > 0 ? (
        <>
          <p className="review__big">
            <span className="review__count">{due.length}</span>
            <span className="review__unit">{t("to review today.")}</span>
          </p>
          {waiting > 0 && <p className="review__sub">{t("The other {n} can wait.", { n: waiting })}</p>}
          <button className="btn btn--primary btn--wide" onClick={begin}>
            {t(due.length === 1 ? "Review {n} word" : "Review {n} words", { n: due.length })}
          </button>
        </>
      ) : totalWords > 0 ? (
        <>
          <p className="review__big">{t("Nothing to review today.")}</p>
          <p className="review__sub">
            {waiting > 0
              ? t("The other {n} can wait.", { n: waiting })
              : t(totalWords === 1 ? "{n} saved word is scheduled." : "{n} saved words are scheduled.", { n: totalWords })}
          </p>
          <button className="btn" onClick={onGoRead}>
            {t("Read more")}
          </button>
        </>
      ) : (
        <>
          <p className="review__big">{t("Review is empty")}</p>
          <p className="review__sub">
            {t("Words you save in Read or Watch show up here, spaced so you see each one just before you’d forget it.")}{" "}
            {t("Tap a word and choose “Save to review”.")}
          </p>
          <div className="review__actions">
            <button className="btn btn--primary" onClick={onGoRead}>{t("Open Read")}</button>
            <button className="btn btn--quiet" onClick={onGoWatch}>{t("Open Watch")}</button>
          </div>
        </>
      )}
      <WeekLine state={state} t={t} />
    </section>
  );
}
