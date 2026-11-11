import { useRef, useState } from "react";
import { noFocus } from "./WatchControls";
import Icon from "./Icon";

const ACCEPT = "video/*,.mkv,.srt,.vtt,.ass,.ssa";

// Where the learner brings their own files. The drop itself is handled by
// WatchView (the whole tab is a drop target); this only highlights and offers
// a file picker.
export default function WatchDrop({ onFiles, onSample, onMakeSubtitles, sampleLoading, hasVideo, hasSubs, error, compact, stage, pickerRef, onChoose }) {
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
          Change files
        </button>
        {input}
      </>
    );
  }

  const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const prompt =
    hasVideo && !hasSubs
      ? "Playing without subtitles. Add the subtitle file (.srt, .vtt or .ass) to read along."
      : hasSubs && !hasVideo
        ? "Subtitles are in. Now add the video file."
        : touch
          ? "Choose a video and its Japanese subtitles."
          : "Drop a video and its Japanese subtitles here.";

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
      <p className="watch-drop__hint">Add an English subtitle file too if you want it under each line.</p>
      <div className="watch-drop__actions">
        <button
          className="btn btn--primary"
          onMouseDown={noFocus}
          onClick={() => {
            onChoose?.();
            inputRef.current.click();
          }}
        >
          Choose files
        </button>
        {onMakeSubtitles && hasVideo && !hasSubs && (
          <button className="btn" onMouseDown={noFocus} onClick={onMakeSubtitles}>
            Make subtitles
          </button>
        )}
        {onSample && !hasVideo && !hasSubs && (
          <button className="btn" onMouseDown={noFocus} onClick={onSample} disabled={sampleLoading}>
            {sampleLoading ? "Loading sample…" : "Try a sample clip"}
          </button>
        )}
      </div>
      {input}
      {error && (
        <p className="note note--error" role="alert">
          {error}
        </p>
      )}
      <p className="note">Your files stay on your computer. Nothing is uploaded.</p>
      <p className="note">
        Need Japanese subtitles for anime? Try{" "}
        <a href="https://jimaku.cc" target="_blank" rel="noreferrer">
          Jimaku
        </a>
        .
      </p>
    </div>
  );
}
