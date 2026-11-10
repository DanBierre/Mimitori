const SPEEDS = [0.5, 0.75, 1, 1.25];

// Mouse clicks shouldn't leave focus on a control, or the next Space press
// would click it again instead of playing/pausing. Keyboard focus still works.
const noFocus = (e) => e.preventDefault();

function Btn({ children, className = "btn", ...props }) {
  return (
    <button className={className} onMouseDown={noFocus} {...props}>
      {children}
    </button>
  );
}

export function formatOffset(ms) {
  if (ms === 0) return "on time";
  const s = (Math.abs(ms) / 1000).toFixed(1);
  return ms > 0 ? `+${s} s (later)` : `−${s} s (earlier)`;
}

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
  onFocus,
  onHelp,
}) {
  return (
    <div className="watch-controls">
      <div className="watch-controls__row" role="group" aria-label="Lines">
        <Btn onClick={onPrev} aria-label="Previous line (←)">
          ‹ Prev
        </Btn>
        <Btn className="btn btn--primary" onClick={onReplay} aria-label="Replay line (R)">
          ↺ Replay line
        </Btn>
        <Btn onClick={onNext} aria-label="Next line (→)">
          Next ›
        </Btn>
        <Btn
          className="btn watch-controls__toggle"
          aria-pressed={autoPause}
          onClick={() => onAutoPause(!autoPause)}
        >
          Pause after each line
        </Btn>
      </div>

      <div className="watch-controls__row">
        <div className="segmented" role="group" aria-label="Speed">
          <span className="segmented__label">Speed</span>
          {SPEEDS.map((s) => (
            <Btn key={s} className="segmented__btn" aria-pressed={speed === s} onClick={() => onSpeed(s)}>
              {s}×
            </Btn>
          ))}
        </div>
        {hasSecondLine && (
          <Btn
            className="btn watch-controls__toggle"
            aria-pressed={showSecondLine}
            onClick={onToggleSecondLine}
          >
            Second line
          </Btn>
        )}
        {onFocus && <Btn onClick={onFocus}>Focus (F)</Btn>}
        <Btn className="btn btn--quiet" onClick={onHelp} aria-label="Keyboard shortcuts (?)">
          ?
        </Btn>
      </div>

      <div className="watch-controls__row watch-controls__timing" role="group" aria-label="Subtitle timing">
        <span className="segmented__label">Timing: {formatOffset(offsetMs)}</span>
        <div className="stepper">
          <Btn className="stepper__btn" onClick={() => onNudge(-500)} aria-label="Subtitles 0.5 seconds earlier">
            −0.5
          </Btn>
          <Btn className="stepper__btn" onClick={() => onNudge(-100)} aria-label="Subtitles 0.1 seconds earlier ([)">
            −0.1
          </Btn>
          <Btn className="stepper__btn" onClick={() => onNudge(100)} aria-label="Subtitles 0.1 seconds later (])">
            +0.1
          </Btn>
          <Btn className="stepper__btn" onClick={() => onNudge(500)} aria-label="Subtitles 0.5 seconds later">
            +0.5
          </Btn>
        </div>
        <Btn onClick={onLineUp}>Line up a line</Btn>
        <Btn className="btn btn--quiet" onClick={onDownload} disabled={offsetMs === 0}>
          Download fixed subtitles
        </Btn>
      </div>

      {syncText !== null && (
        <div className="watch-controls__row watch-controls__sync" role="status">
          <span>
            When you hear{" "}
            <span lang="ja" className="watch-controls__sync-line">
              「{syncText}」
            </span>
            , press Now.
          </span>
          <Btn className="btn btn--primary" onClick={onSyncNow}>
            Now
          </Btn>
          <Btn className="btn btn--quiet" onClick={onSyncCancel}>
            Cancel
          </Btn>
        </div>
      )}
    </div>
  );
}

export const SHORTCUTS = [
  ["Space", "Play / pause"],
  ["R", "Replay the line"],
  ["← / →", "Previous / next line"],
  ["[ / ]", "Subtitles 0.1 s earlier / later"],
  ["F", "Focus mode"],
  ["?", "Show or hide these shortcuts"],
];
