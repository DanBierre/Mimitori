import { useState } from "react";
import { createFlags } from "../lib/firstRun";
import { useT } from "../lib/store";
import { noFocus } from "./WatchControls";
import Icon from "./Icon";

const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
const TIPS = [
  ["Tap any word", "You'll see its reading, its meaning and how it's conjugated."],
  ["Missed it?", touch ? "Tap the replay button to hear the line again." : "Press R, or the replay button, to hear the line again."],
  [
    "Keep the good ones",
    "Use Save to review on a word's card. With Anki connected, it becomes a card with audio and a picture." +
      (touch ? "" : " Press ? any time for keyboard shortcuts."),
  ],
];

const flags = createFlags();

// Three quick tips, shown once, the first time any clip is ready to play.
export default function WatchTips() {
  const tr = useT();
  const [step, setStep] = useState(() => (flags.has("tips") ? -1 : 0));
  if (step < 0) return null;

  const done = () => {
    flags.set("tips");
    setStep(-1);
  };
  const [title, body] = TIPS[step];
  const last = step === TIPS.length - 1;

  return (
    <div className="popover watch__help watch__tips" role="region" aria-label={tr("Tips")}>
      <div className="popover__head">
        <strong>{tr(title)}</strong>
        <button className="icon-btn" onMouseDown={noFocus} onClick={done} aria-label={tr("Skip tips")}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className="watch__tips-body">{tr(body)}</p>
      <div className="watch__tips-foot">
        <span className="watch__tips-count">
          {tr("{n} of {total}", { n: step + 1, total: TIPS.length })}
        </span>
        <button className="btn btn--primary" onMouseDown={noFocus} onClick={last ? done : () => setStep(step + 1)}>
          {last ? tr("Got it") : tr("Next")}
        </button>
      </div>
    </div>
  );
}
