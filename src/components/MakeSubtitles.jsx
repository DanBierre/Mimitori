import { noFocus } from "./WatchControls";
import { useT } from "../lib/store";

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// The progress row under the player while subtitles are made, plus the
// first-use download card. `t` is the useTranscribe result.
export default function MakeSubtitles({ t, card, onConfirm, onCancel, onDownload }) {
  const tr = useT();
  if (card) {
    return (
      <div className="make-subs make-subs--card" role="region" aria-label={tr("Make subtitles")}>
        <p>{tr("Making subtitles downloads a 564 MB speech model the first time. After that it works offline.")}</p>
        <div className="make-subs__actions">
          <button className="btn btn--primary" onMouseDown={noFocus} onClick={onConfirm}>
            {tr("Download and start")}
          </button>
          <button className="btn" onMouseDown={noFocus} onClick={onCancel}>
            {tr("Not now")}
          </button>
        </div>
      </div>
    );
  }

  const { status, task, record } = t;
  const time = <span aria-hidden="true">{clock(t.progressS)} of {clock(t.totalS)}</span>;
  let row = null;
  if (status === "loading-model") {
    // After the download the model still has to warm up on the GPU (a minute or two).
    row =
      t.modelPct >= 100 ? (
        <>{tr("Warming up the speech model… This can take a couple of minutes.")}</>
      ) : (
        <>{tr("Getting the speech model… {n}%", { n: t.modelPct })}</>
      );
  } else if (status === "running" && task === "translate") {
    row = <>{tr("Making the English line…")} {time}</>;
  } else if (status === "running") {
    row = (
      <>
        {tr("Making subtitles…")} {time}{" "}
        <button className="link" onMouseDown={noFocus} onClick={t.stop}>
          {tr("Stop")}
        </button>
      </>
    );
  } else if (record.done) {
    row = (
      <>
        {tr(record.ja.length === 1 ? "Subtitles ready. {n} line." : "Subtitles ready. {n} lines.", { n: record.ja.length })}{" "}
        {onDownload && (
          <button className="link" onMouseDown={noFocus} onClick={onDownload}>
            {tr("Download .srt")}
          </button>
        )}
      </>
    );
  } else if (record.ja.length) {
    row = (
      <>
        {tr("You stopped part-way through.")}{" "}
        <button className="link" onMouseDown={noFocus} onClick={t.carryOn}>
          {tr("Carry on")}
        </button>
      </>
    );
  }
  if (!row) return null;

  return (
    <p className="make-subs" role="status" aria-atomic="true">
      {row}
      {t.device === "wasm" && status === "running" && (
        <span className="make-subs__slow"> {tr("This computer will take about as long as the video, maybe longer.")}</span>
      )}
    </p>
  );
}
