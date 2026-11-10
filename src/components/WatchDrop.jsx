import { useRef, useState } from "react";
import { noFocus } from "./WatchControls";

const ACCEPT = "video/*,.mkv,.srt,.vtt,.ass,.ssa";

// Where the learner brings their own files. The drop itself is handled by
// WatchView (the whole tab is a drop target); this only highlights and offers
// a file picker.
export default function WatchDrop({ onFiles, hasVideo, hasSubs, error, compact }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);

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
        <button className="btn btn--quiet" onMouseDown={noFocus} onClick={() => inputRef.current.click()}>
          Change files
        </button>
        {input}
      </>
    );
  }

  const prompt =
    hasVideo && !hasSubs
      ? "Now add the subtitle file (.srt, .vtt or .ass)."
      : hasSubs && !hasVideo
        ? "Now add the video file."
        : "Drop a video and its Japanese subtitles here.";

  return (
    <div
      className={`watch-drop ${over ? "watch-drop--over" : ""}`}
      onDragOver={() => setOver(true)}
      onDragLeave={() => setOver(false)}
      onDrop={() => setOver(false)}
    >
      <p className="watch-drop__prompt">{prompt}</p>
      <p className="watch-drop__hint">Add an English subtitle file too if you want it under each line.</p>
      <button className="btn btn--primary" onMouseDown={noFocus} onClick={() => inputRef.current.click()}>
        Choose files
      </button>
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
