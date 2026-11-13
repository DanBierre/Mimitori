import { useEffect, useState } from "react";
import { lookupWord } from "../lib/dict";
import { conjugationParts } from "../lib/conjugation";
import { useStore, wordState } from "../lib/store";
import { noFocus } from "./WatchControls";

const STATE = { new: "new", saved: "saved", due: "due", inAnki: "in Anki" };

// The word-by-word readout under the line: one row per numbered word (word,
// reading, meaning, state). The numbers match the small ones on the line and
// on the entry; picking a row picks the word, like tapping it or pressing its number.
export default function Readout({ tokens, picks, selected, onSelect }) {
  const { state } = useStore();
  const [found, setFound] = useState({});
  const key = picks.map((i) => tokens[i].base).join("|");

  useEffect(() => {
    let live = true;
    Promise.all(picks.map((i) => lookupWord(tokens[i]))).then((list) => {
      if (!live) return;
      const next = {};
      list.forEach((d, k) => (next[tokens[picks[k]].base] = d));
      setFound(next);
    });
    return () => {
      live = false;
    };
  }, [tokens, key]);

  return (
    <table className="readout">
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">Number</span>
          </th>
          <th scope="col">Word</th>
          <th scope="col" className="readout__rd">
            Reading
          </th>
          <th scope="col">Meaning</th>
          <th scope="col">State</th>
        </tr>
      </thead>
      <tbody>
        {picks.map((i, k) => {
          const t = tokens[i];
          const d = found[t.base];
          const meaning = [d?.glosses[0], ...conjugationParts(tokens, i)].filter(Boolean).join(" · ");
          return (
            <tr key={i} aria-selected={selected === i} onClick={() => onSelect(selected === i ? null : i)}>
              <td className="readout__n">{k + 1}</td>
              <td className="readout__jw" lang="ja">
                <button className="readout__pick" onMouseDown={noFocus} aria-pressed={selected === i}>
                  {t.base}
                </button>
              </td>
              <td className="readout__rd" lang="ja">
                {d?.reading || t.reading}
              </td>
              <td className="readout__mn">{meaning}</td>
              <td className="readout__st">{STATE[wordState(state, t.base)] ?? ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
