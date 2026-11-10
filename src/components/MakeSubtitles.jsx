import { noFocus } from "./WatchControls";

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// The progress row under the player while subtitles are made, plus the
// first-use download card. `t` is the useTranscribe result.
export default function MakeSubtitles({ t, card, wantEnglish, onEnglish, onConfirm, onCancel, onDownload }) {
  if (card) {
    return (
      <div className="make-subs make-subs--card" role="region" aria-label="Make subtitles">
        <p>Making subtitles downloads a 564 MB speech model the first time. After that it works offline.</p>
        <div className="make-subs__actions">
          <button className="btn btn--primary" onMouseDown={noFocus} onClick={onConfirm}>
            Download and start
          </button>
          <button className="btn" onMouseDown={noFocus} onClick={onCancel}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  const { status, task, record } = t;
  const time = `${clock(t.progressS)} of ${clock(t.totalS)}`;
  let row = null;
  if (status === "loading-model") {
    row = <>Getting the speech model… {t.modelPct}%</>;
  } else if (status === "running" && task === "translate") {
    row = <>Making the English line… {time}</>;
  } else if (status === "running") {
    row = (
      <>
        Making subtitles… {time}{" "}
        <button className="link" onMouseDown={noFocus} onClick={t.stop}>
          Stop
        </button>{" "}
        <label className="make-subs__check">
          <input type="checkbox" checked={wantEnglish} onChange={(e) => onEnglish(e.target.checked)} /> Also make English
        </label>
      </>
    );
  } else if (record.done) {
    row = (
      <>
        Subtitles ready. {record.ja.length} lines.{" "}
        {onDownload && (
          <button className="link" onMouseDown={noFocus} onClick={onDownload}>
            Download .srt
          </button>
        )}
      </>
    );
  } else if (record.ja.length) {
    row = (
      <>
        You stopped part-way through.{" "}
        <button className="link" onMouseDown={noFocus} onClick={t.carryOn}>
          Carry on
        </button>
      </>
    );
  }
  if (!row) return null;

  return (
    <p className="make-subs" role="status">
      {row}
      {t.device === "wasm" && status === "running" && (
        <span className="make-subs__slow"> This computer will take about as long as the video, maybe longer.</span>
      )}
    </p>
  );
}
