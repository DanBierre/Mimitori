import { useMemo } from "react";
import { ankiMode, knownTotal, useReviewToday, useStore } from "../lib/store";
import { reviewNote } from "../lib/srs";
import { savedThisWeek, weekForecast } from "../lib/forecast";

// The right column while nothing is loaded: the learner's own numbers for today.
export default function WatchToday() {
  const { state } = useStore();
  const today = useReviewToday();
  const words = useMemo(() => Object.values(state.words), [state.words]);
  const week = useMemo(() => weekForecast(words), [words]);
  const saved = savedThisWeek(words);
  const known = knownTotal(state);
  const top = Math.max(1, ...week.map((d) => d.count));

  return (
    <aside className="watch__side watch__today" aria-label="Today">
      <div className="watch__side-head">
        <strong>Today</strong>
      </div>
      {!ankiMode(state) && <p className="today__review">{reviewNote(today.queue.length, today.waiting)}</p>}
      <p className="today__known">
        <span className="today__fig">{known}</span>
        <span>{known === 1 ? "word known" : "words known"}</span>
      </p>
      <p className="today__saved">
        <span className="today__num">{saved}</span> {saved === 1 ? "word" : "words"} saved this week
      </p>
      <div className="today__week">
        <p className="today__week-title">Cards due this week</p>
        <ol className="today__days" role="img" aria-label={week.map((d) => `${d.label} ${d.count}`).join(", ")}>
          {week.map((d) => (
            <li key={d.label} className={d.today ? "today__day today__day--now" : "today__day"} aria-hidden="true">
              <span className="today__count">{d.count}</span>
              <span className="today__bar">
                <i style={{ height: `${d.count ? Math.max(3, (d.count / top) * 40) : 1}px` }} />
              </span>
              <span className="today__label">{d.label}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="watch__foot">
        <p>No account. Everything stays on this computer.</p>
      </div>
    </aside>
  );
}
