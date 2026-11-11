import TokenLine from "./TokenLine";
import { useStore } from "../lib/store";

// "On this page": this page's lines, newest first. selected = { lineId, tokenIndex } | null.
export default function PageLines({ lines, tokensById, currentId, selected, onSelect, onPick }) {
  const { state } = useStore();
  if (!lines.length) {
    return <p className="note book__empty">No lines yet. Press B and drag over a bubble.</p>;
  }
  return (
    <ol className="book__lines" lang="ja" style={{ "--read-size": `${Math.min(state.settings.size, 26)}px` }}>
      {lines.map((l) => (
        <li key={l.id} className={`book__line${l.id === currentId ? " book__line--current" : ""}`}>
          {tokensById[l.id] ? (
            <TokenLine
              tokens={tokensById[l.id]}
              selected={selected?.lineId === l.id ? selected.tokenIndex : null}
              onSelect={(i) => onSelect(l.id, i)}
            />
          ) : (
            <button type="button" className="book__raw" onClick={() => onPick(l.id)}>
              {l.text}
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}
