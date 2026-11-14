import { useRef, useState } from "react";
import { noFocus } from "./WatchControls";
import { useT } from "../lib/store";
import Icon from "./Icon";

const ACCEPT = "video/*,.mkv,.srt,.vtt,.ass,.ssa";

// Where the learner brings their own files. The drop itself is handled by
// WatchView (the whole tab is a drop target); this only highlights and offers
// a file picker.
export default function WatchDrop({ onFiles, onSample, onMakeSubtitles, sampleLoading, hasVideo, hasSubs, error, compact, stage, pickerRef, onChoose }) {
  const tr = useT();
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

  // Lets Carry on (in Recent) open the same file picker.
  if (pickerRef && !compact) pickerRef.current = () => inputRef.current?.click();

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT}
      hidden
      onChange={(e) => {
        onFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );

  if (compact) {
    return (
      <>
        <button className="link" onMouseDown={noFocus} onClick={() => inputRef.current.click()}>
          {tr("Change files")}
        </button>
        {input}
      </>
    );
  }

  const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const prompt =
    hasVideo && !hasSubs
      ? tr("Playing without subtitles. Add the subtitle file (.srt, .vtt or .ass) to read along.")
      : hasSubs && !hasVideo
        ? tr("Subtitles are in. Now add the video file.")
        : touch
          ? tr("Choose a video and its Japanese subtitles.")
          : tr("Drop a video and its Japanese subtitles here.");

  return (
    <div
      className={`watch-drop ${stage ? "watch-drop--stage" : ""} ${over ? "watch-drop--over" : ""}`}
      onDragOver={() => setOver(true)}
      onDragLeave={() => setOver(false)}
      onDrop={() => setOver(false)}
    >
      <span className="watch-drop__icon" aria-hidden="true">
        <Icon name="upload" size={26} />
      </span>
      <h2 className="watch-drop__prompt">{prompt}</h2>
      <p className="watch-drop__hint">{tr("Add an English subtitle file too if you want it under each line.")}</p>
      <div className="watch-drop__actions">
        <button
          className="btn btn--primary"
          onMouseDown={noFocus}
          onClick={() => {
            onChoose?.();
            inputRef.current.click();
          }}
        >
          {tr("Choose files")}
        </button>
        {onMakeSubtitles && hasVideo && !hasSubs && (
          <button className="btn" onMouseDown={noFocus} onClick={onMakeSubtitles}>
            {tr("Make subtitles")}
          </button>
        )}
        {onSample && !hasVideo && !hasSubs && (
          <button className="btn" onMouseDown={noFocus} onClick={onSample} disabled={sampleLoading}>
            {sampleLoading ? tr("Loading sample…") : tr("Try a sample clip")}
          </button>
        )}
      </div>
      {input}
      {error && (
        <p className="note note--error" role="alert">
          {tr(error)}
        </p>
      )}
      <p className="note">{tr("Your files stay on your computer. Nothing is uploaded.")}</p>
      <p className="note">
        {tr("Need Japanese subtitles for anime? Try")}{" "}
        <a href="https://jimaku.cc" target="_blank" rel="noreferrer">
          Jimaku
        </a>
        .
      </p>
    </div>
  );
}
