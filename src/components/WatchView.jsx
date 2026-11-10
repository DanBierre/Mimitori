import { useEffect, useRef, useState } from "react";
import { getTokenizer, tokenizeWithReadings, JAPANESE_REGEX } from "../lib/furigana";
import { readSubtitleFile, isVideoFile } from "../lib/subtitles/loadFile";
import { cueIndexAt, pickPrimary } from "../lib/subtitles/cues";
import { useStore } from "../lib/store";
import TokenLine from "./TokenLine";
import WordPanel from "./WordPanel";
import WatchDrop from "./WatchDrop";

const NO_LINES = "We couldn't read any lines from this file. Is it a .srt, .vtt or .ass file?";
const BAD_VIDEO = "Your browser can't play this video. MP4 files work best. Chrome and Edge play the most formats.";

const hasJapanese = (cues) => cues.some((c) => JAPANESE_REGEX.test(c.text));

// The learner's own video + subtitle files, played locally. The current line
// renders through TokenLine (furigana, tappable words) and words open the same
// WordPanel as Read, so saved words land in Review.
export default function WatchView({ active }) {
  const { state } = useStore();
  const { size } = state.settings;
  const { showSecondLine } = state.settings.watch;

  const videoRef = useRef(null);
  const [video, setVideo] = useState(null); // { url, name }
  const [videoError, setVideoError] = useState(false);
  const [primary, setPrimary] = useState(null); // { name, cues, skipped }
  const [second, setSecond] = useState(null);
  const [fileError, setFileError] = useState("");

  const [tokens, setTokens] = useState([]); // per primary cue: token[] | null
  const [readings, setReadings] = useState("idle"); // idle | loading | ready | error
  const [retry, setRetry] = useState(0);

  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  offsetRef.current = offset;
  const [current, setCurrent] = useState(-1);
  const [secondCurrent, setSecondCurrent] = useState(-1);
  const [selection, setSelection] = useState(null); // { cue, token }

  // Release the old object URL whenever the video changes or the tab unmounts.
  useEffect(() => () => video && URL.revokeObjectURL(video.url), [video]);

  // Leaving the tab pauses the video; it keeps its place.
  useEffect(() => {
    if (!active) videoRef.current?.pause();
  }, [active]);

  function loadPrimary(file) {
    setPrimary(file);
    setOffset(0);
    setSelection(null);
    setTokens([]);
  }

  async function handleFiles(list) {
    const files = [...list];
    if (!files.length) return;
    setFileError("");

    const vid = files.find(isVideoFile);
    if (vid) {
      setVideo({ url: URL.createObjectURL(vid), name: vid.name });
      setVideoError(false);
    }

    // Anything that isn't a video is tried as subtitles, so a mislabelled
    // file still gets a clear message instead of being ignored.
    const subFiles = files.filter((f) => !isVideoFile(f)).slice(0, 2);
    if (!subFiles.length) return;
    const parsed = await Promise.all(subFiles.map(readSubtitleFile));
    const good = parsed.filter((p) => p.cues.length);
    if (!good.length) {
      setFileError(NO_LINES);
      return;
    }

    if (good.length === 2) {
      const [main] = pickPrimary(good[0].cues, good[1].cues);
      const [a, b] = main === good[0].cues ? good : [good[1], good[0]];
      loadPrimary(a);
      setSecond(b);
    } else if (hasJapanese(good[0].cues) || !primary) {
      loadPrimary(good[0]);
    } else {
      setSecond(good[0]);
    }
  }

  // Tokenize every Japanese line once the tokenizer is ready. An episode is
  // ~300 lines, well under a second.
  // Whole file up front; tokenize around the current line if huge files get slow.
  useEffect(() => {
    if (!primary) return;
    let cancelled = false;
    setReadings("loading");
    (async () => {
      try {
        await getTokenizer();
        const out = [];
        for (const cue of primary.cues) {
          out.push(JAPANESE_REGEX.test(cue.text) ? await tokenizeWithReadings(cue.text) : null);
        }
        if (!cancelled) {
          setTokens(out);
          setReadings("ready");
        }
      } catch {
        if (!cancelled) setReadings("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [primary, retry]);

  // Track the current line every frame while playing, and once after seeks.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !primary) return;
    let raf = 0;
    const tick = () => {
      const t = v.currentTime * 1000;
      setCurrent(cueIndexAt(primary.cues, t, offsetRef.current));
      setSecondCurrent(second ? cueIndexAt(second.cues, t, 0) : -1);
      if (!v.paused) raf = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(raf);
      tick();
    };
    const events = ["play", "seeked", "loadedmetadata"];
    events.forEach((e) => v.addEventListener(e, restart));
    restart();
    return () => {
      cancelAnimationFrame(raf);
      events.forEach((e) => v.removeEventListener(e, restart));
    };
  }, [video, primary, second, offset]);

  function selectWord(i) {
    if (i === null) {
      setSelection(null);
      return;
    }
    videoRef.current?.pause();
    setSelection({ cue: current, token: i });
  }

  const ready = Boolean(video && primary);
  const cue = primary && current !== -1 ? primary.cues[current] : null;
  const lineTokens = current !== -1 ? tokens[current] : null;
  const secondCue = second && showSecondLine && secondCurrent !== -1 ? second.cues[secondCurrent] : null;
  const selectedToken = selection ? tokens[selection.cue]?.[selection.token] : null;
  const panelOpen = Boolean(selectedToken);

  return (
    <div
      className={`watch ${panelOpen ? "watch--panel-open" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
      }}
    >
      <section className="sheet watch__sheet" aria-label="Watch">
        {!ready && (
          <WatchDrop
            onFiles={handleFiles}
            hasVideo={Boolean(video)}
            hasSubs={Boolean(primary)}
            error={fileError || (videoError ? BAD_VIDEO : "")}
          />
        )}

        {video && (
          <div className="watch__stage">
            <video
              ref={videoRef}
              className="watch__video"
              src={video.url}
              controls
              playsInline
              onError={() => setVideoError(true)}
            />

            {primary && (
              <div className="watch__lines" style={{ "--read-size": `${size}px` }}>
                <p className="watch__line" lang="ja" aria-live="polite">
                  {!cue ? (
                    " "
                  ) : lineTokens ? (
                    <TokenLine
                      tokens={lineTokens}
                      selected={selection?.cue === current ? selection.token : null}
                      onSelect={selectWord}
                    />
                  ) : (
                    cue.text
                  )}
                </p>
                {second && showSecondLine && <p className="watch__second">{secondCue ? secondCue.text : " "}</p>}
              </div>
            )}
          </div>
        )}

        {ready && (
          <div className="watch__notes">
            {videoError && (
              <p className="note note--error" role="alert">
                {BAD_VIDEO}
              </p>
            )}
            {fileError && (
              <p className="note note--error" role="alert">
                {fileError}
              </p>
            )}
            {readings === "loading" && <p className="note">Loading readings…</p>}
            {readings === "error" && (
              <p className="note">
                The reading engine didn’t load, so lines show without furigana.{" "}
                <button className="btn btn--quiet" onClick={() => setRetry((n) => n + 1)}>
                  Try again
                </button>
              </p>
            )}
            {primary.skipped > 0 && <p className="note">Skipped {primary.skipped} lines we couldn't read.</p>}
            <WatchDrop compact onFiles={handleFiles} />
          </div>
        )}
      </section>

      {selectedToken && (
        <WordPanel
          token={selectedToken}
          sentence={primary.cues[selection.cue].text.replace(/\n/g, "")}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  );
}
