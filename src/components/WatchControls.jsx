import { useEffect, useState } from "react";
import { useT } from "../lib/store";
import Icon from "./Icon";

const SPEEDS = [0.5, 0.75, 1, 1.25];

// Mouse clicks shouldn't leave focus on a control, or the next Space press
// would click it again instead of playing/pausing. Keyboard focus still works.
export const noFocus = (e) => e.preventDefault();

function IconBtn({ icon, label, className = "", pressed, onClick, size = 20, ...rest }) {
  return (
    <button
      className={`ctl-btn ${className}`}
      onMouseDown={noFocus}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

export function formatOffset(ms, tr = (s) => s) {
  if (ms === 0) return tr("On time");
  const s = (Math.abs(ms) / 1000).toFixed(1);
  return tr(ms > 0 ? "{s} s later" : "{s} s earlier", { s });
}

// One slim player bar: line controls on the left, settings as small icons on
// the right. Timing lives in a pop-up so it never crowds the bar.
export default function WatchControls({
  onReplay,
  onPrev,
  onNext,
  speed,
  onSpeed,
  autoPause,
  onAutoPause,
  offsetMs,
  onNudge,
  onLineUp,
  syncText = null,
  onSyncNow,
  onSyncCancel,
  onDownload,
  hasSecondLine,
  showSecondLine,
  onToggleSecondLine,
  transcriptOpen,
  onToggleTranscript,
  onFocus,
  onHelp,
}) {
  const tr = useT();
  const [timingOpen, setTimingOpen] = useState(false);
  const showTiming = timingOpen || syncText !== null;

  // Esc closes the timing box (and cancels Line up a line).
  useEffect(() => {
    if (!showTiming) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (syncText !== null) onSyncCancel();
      setTimingOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTiming, syncText, onSyncCancel]);

  return (
    <div className="ctl">
      <div className="ctl__group">
        <IconBtn icon="prev" label={tr("Previous line (←)")} onClick={onPrev} />
        <IconBtn icon="replay" label={tr("Replay line (R)")} className="ctl-btn--primary" onClick={onReplay} size={22} />
        <IconBtn icon="next" label={tr("Next line (→)")} onClick={onNext} />
        <span className="ctl__sep" aria-hidden="true" />
        <button
          className="ctl-chip"
          onMouseDown={noFocus}
          aria-pressed={autoPause}
          onClick={() => onAutoPause(!autoPause)}
          title={tr("Pause after each line")}
        >
          <Icon name="autoPause" size={18} />
          <span className="ctl-chip__label">{tr("Pause after each line")}</span>
        </button>
      </div>

      <div className="ctl__group">
        <label className="ctl-select" title={tr("Speed")}>
          <span className="sr-only">{tr("Speed")}</span>
          <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </label>
        {hasSecondLine && (
          <IconBtn icon="captions" label={tr("Second subtitle line")} pressed={showSecondLine} onClick={onToggleSecondLine} />
        )}
        <IconBtn
          icon="timing"
          label={tr("Subtitle timing")}
          pressed={showTiming || offsetMs !== 0}
          aria-expanded={showTiming}
          onClick={() => setTimingOpen((o) => !o)}
        />
        <IconBtn
          icon="transcript"
          label={tr("Transcript")}
          className="ctl-btn--transcript"
          pressed={transcriptOpen}
          onClick={onToggleTranscript}
        />
        <IconBtn icon="focus" label={tr("Focus mode (F)")} onClick={onFocus} />
        <IconBtn icon="help" label={tr("Keyboard shortcuts (?)")} onClick={onHelp} />
      </div>

      {showTiming && (
        <div className="popover ctl__timing" role="group" aria-label={tr("Subtitle timing")}>
          <div className="popover__head">
            <strong>{tr("Subtitle timing")}</strong>
            <span className="popover__meta">{formatOffset(offsetMs, tr)}</span>
            <button
              className="icon-btn"
              onMouseDown={noFocus}
              onClick={() => {
                if (syncText !== null) onSyncCancel();
                setTimingOpen(false);
              }}
              aria-label={tr("Close subtitle timing")}
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          {syncText === null ? (
            <>
              <div className="nudge" role="group" aria-label={tr("Shift subtitles")}>
                <button className="btn" onMouseDown={noFocus} onClick={() => onNudge(-500)} aria-label={tr("0.5 seconds earlier")}>
                  −0.5
                </button>
                <button className="btn" onMouseDown={noFocus} onClick={() => onNudge(-100)} aria-label={tr("0.1 seconds earlier")}>
                  −0.1
                </button>
                <button className="btn" onMouseDown={noFocus} onClick={() => onNudge(100)} aria-label={tr("0.1 seconds later")}>
                  +0.1
                </button>
                <button className="btn" onMouseDown={noFocus} onClick={() => onNudge(500)} aria-label={tr("0.5 seconds later")}>
                  +0.5
                </button>
              </div>
              <div className="popover__actions">
                <button className="btn btn--primary" onMouseDown={noFocus} onClick={onLineUp}>
                  {tr("Line up a line")}
                </button>
                <button className="btn btn--quiet" onMouseDown={noFocus} onClick={onDownload} disabled={offsetMs === 0}>
                  <Icon name="download" size={16} />
                  {tr("Download fixed file")}
                </button>
              </div>
              <p className="popover__hint only-fine">
                {tr("Tip:")} <kbd>[</kbd> <kbd>]</kbd> {tr("nudge by 0.1 s while you watch.")}
              </p>
            </>
          ) : (
            <>
              <p className="popover__text">
                {tr("When you hear")}{" "}
                <span lang="ja" className="ctl__sync-line">
                  「{syncText}」
                </span>
                {tr(", press Now.")}
              </p>
              <div className="popover__actions">
                <button className="btn btn--primary" onMouseDown={noFocus} onClick={onSyncNow}>
                  {tr("Now")}
                </button>
                <button className="btn btn--quiet" onMouseDown={noFocus} onClick={onSyncCancel}>
                  {tr("Cancel")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export const SHORTCUTS = [
  ["Space", "Play / pause"],
  ["R", "Replay the line"],
  ["← →", "Previous / next line"],
  ["[ ]", "Subtitles 0.1 s earlier / later"],
  ["1–9", "Pick a numbered word in the line"],
  ["A / S", "Add or save the tapped word"],
  ["K", "Mark the tapped word as known"],
  ["Esc", "Close the word card"],
  ["F", "Focus mode"],
  ["?", "Show or hide these shortcuts"],
];
