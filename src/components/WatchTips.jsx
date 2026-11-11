import { useState } from "react";
import { createFlags } from "../lib/firstRun";
import { noFocus } from "./WatchControls";
import Icon from "./Icon";

const TIPS = [
  ["Tap any word", "You'll see its reading, its meaning and how it's conjugated."],
  ["Missed it?", "Press R, or the replay button, to hear the line again."],
  ["Keep the good ones", "Use Save to review on a word's card. With Anki connected, it becomes a card with audio and a picture."],
];

const flags = createFlags();

// Three quick tips, shown once, the first time any clip is ready to play.
export default function WatchTips() {
  const [step, setStep] = useState(() => (flags.has("tips") ? -1 : 0));
  if (step < 0) return null;

  const done = () => {
    flags.set("tips");
    setStep(-1);
  };
  const [title, body] = TIPS[step];
  const last = step === TIPS.length - 1;

  return (
    <div className="popover watch__help watch__tips" role="region" aria-label="Tips">
      <div className="popover__head">
        <strong>{title}</strong>
        <button className="icon-btn" onMouseDown={noFocus} onClick={done} aria-label="Skip tips">
          <Icon name="close" size={18} />
        </button>
      </div>
      <p className="watch__tips-body">{body}</p>
      <div className="watch__tips-foot">
        <span className="watch__tips-count">
          {step + 1} of {TIPS.length}
        </span>
        <button className="btn btn--primary" onMouseDown={noFocus} onClick={last ? done : () => setStep(step + 1)}>
          {last ? "Got it" : "Next"}
        </button>
      </div>
    </div>
  );
}
