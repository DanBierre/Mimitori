// One thin tick per line, placed at the line's start time across the timeline
// and taller the more new words it holds. Lines with three or more are inked,
// the current one is white. Click or tap to jump to the nearest line.
// Decorative for assistive tech: the transcript is the accessible way to jump.
// One element per line; bucket the lines if files reach thousands.
const HARD = 3;

export default function Ticks({ counts, cues, current, onSeek }) {
  const total = cues.length;
  if (total < 2) return null;
  const span = Math.max(1, cues[total - 1].end ?? cues[total - 1].start + 1000);
  return (
    <div
      className="ticks"
      aria-hidden="true"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(e.currentTarget).paddingLeft) || 0;
        const t = ((e.clientX - r.left - pad) / (r.width - pad * 2)) * span;
        let best = 0;
        for (let i = 1; i < total; i++) if (Math.abs(cues[i].start - t) < Math.abs(cues[best].start - t)) best = i;
        onSeek(best);
      }}
    >
      <div className="ticks__track">
        {cues.map((c, i) => {
          const n = counts[i] || 0;
          const cls = i === current ? "ticks__now" : n >= HARD ? "ticks__hard" : undefined;
          return (
            <i
              key={i}
              className={cls}
              style={{ left: `${Math.min(100, (c.start / span) * 100)}%`, height: `${Math.min(24, 8 + n * 4)}px` }}
            />
          );
        })}
      </div>
    </div>
  );
}
