// One tick per line, taller the more new words it holds. Lines with three or
// more are inked, the current one is white. Click or tap to jump to a line.
// Decorative for assistive tech: the transcript is the accessible way to jump.
// One element per line; bucket the lines if files reach thousands.
const HARD = 3;

export default function Ticks({ counts, total, current, onSeek }) {
  if (total < 2) return null;
  return (
    <div
      className="ticks"
      aria-hidden="true"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(e.currentTarget).paddingLeft) || 0;
        const x = (e.clientX - r.left - pad) / (r.width - pad * 2);
        onSeek(Math.min(total - 1, Math.max(0, Math.floor(x * total))));
      }}
    >
      {Array.from({ length: total }, (_, i) => {
        const n = counts[i] || 0;
        const cls = i === current ? "ticks__now" : n >= HARD ? "ticks__hard" : undefined;
        return <i key={i} className={cls} style={{ height: `${Math.min(100, 14 + n * 20)}%` }} />;
      })}
    </div>
  );
}
