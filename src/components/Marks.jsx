// Marks.jsx
// The sensei's marks, drawn as SVG: the seal that brands the app and the four
// grading marks used in review. Strokes are slightly irregular on purpose so
// they read as ink, not as icons.

export function Seal({ size = 34 }) {
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Nihongo Reader">
      <rect x="2" y="2" width="36" height="36" rx="5" fill="var(--vermilion-felt)" />
      <rect x="5.5" y="5.5" width="29" height="29" rx="2.5" fill="none" stroke="var(--felt)" strokeWidth="1.2" opacity="0.55" />
      <text x="20" y="28.5" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--felt)" fontFamily="var(--font-mincho)">
        読
      </text>
    </svg>
  );
}

const strokeProps = { fill: "none", stroke: "currentColor", strokeWidth: 3.4, strokeLinecap: "round", strokeLinejoin: "round" };

// rating: 1 again, 2 hard, 3 good, 4 easy (ts-fsrs Rating values)
export function GradeMark({ rating, size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={`grade-mark grade-mark--${rating}`}>
      {rating === 1 && (
        <>
          <path d="M12 11 L37 37" {...strokeProps} />
          <path d="M36 10 L11 38" {...strokeProps} />
        </>
      )}
      {rating === 2 && <path d="M24 10 L40 37 L9 36.5 Z" {...strokeProps} />}
      {rating === 3 && <path d="M24 8.5 C35 8.5 40.5 15 40 24.5 C39.5 34 32 40 23 39.5 C13 39 7.5 32 8.5 22.5 C9.5 14 16 8.5 25 9" {...strokeProps} />}
      {rating === 4 && (
        <>
          <path d="M24 5.5 C37 5.5 43 13 42.5 24.5 C42 36 33 43 23 42.5 C12 42 5 34 6 22.5 C7 12 15 5.5 26 6" {...strokeProps} />
          <path d="M24 15 C30.5 15 33.5 19 33.2 24.5 C33 30 29 33.5 23.5 33.2 C18 33 14.5 29 15 23.5 C15.5 18.5 19 15 25 15.3" {...strokeProps} strokeWidth={3} />
        </>
      )}
    </svg>
  );
}
