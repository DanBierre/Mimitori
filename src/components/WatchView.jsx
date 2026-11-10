import { useEffect, useRef, useState } from "react";
import { getTokenizer, tokenizeWithReadings, JAPANESE_REGEX } from "../lib/furigana";
import { readSubtitleFile, isVideoFile } from "../lib/subtitles/loadFile";
import {
  alignOffset,
  cueIndexAt,
  nearestCueIndex,
  nextCueIndex,
  pickPrimary,
  shouldAutoPause,
} from "../lib/subtitles/cues";
import { writeSrt } from "../lib/subtitles/write";
import { useStore } from "../lib/store";
import TokenLine from "./TokenLine";
import WordPanel from "./WordPanel";
import WatchDrop from "./WatchDrop";
import WatchControls, { SHORTCUTS } from "./WatchControls";

const NO_LINES = "We couldn't read any lines from this file. Is it a .srt, .vtt or .ass file?";
const BAD_VIDEO = "Your browser can't play this video. MP4 files work best. Chrome and Edge play the most formats.";

const hasJapanese = (cues) => cues.some((c) => JAPANESE_REGEX.test(c.text));

// The learner's own video + subtitle files, played locally. The current line
// renders through TokenLine (furigana, tappable words) and words open the same
// WordPanel as Read, so saved words land in Review.
export default function WatchView({ active }) {
  const { state, setWatchSettings } = useStore();
  const { size } = state.settings;
  const { showSecondLine, autoPause, speed } = state.settings.watch;
  const autoPauseRef = useRef(autoPause);
  autoPauseRef.current = autoPause;
  const [helpOpen, setHelpOpen] = useState(false);

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
    setSyncTarget(null);
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
    let prev = v.currentTime * 1000;
    let prevIdx = -1;
    let pausedAt = -1; // the line we just auto-paused on, so resuming doesn't pause again
    const tick = () => {
      const t = v.currentTime * 1000;
      const off = offsetRef.current;
      const idx = cueIndexAt(primary.cues, t, off);
      if (prevIdx !== pausedAt) pausedAt = -1;
      if (
        autoPauseRef.current &&
        !v.paused &&
        prevIdx !== -1 &&
        prevIdx !== pausedAt &&
        shouldAutoPause(prev, t, primary.cues[prevIdx], off)
      ) {
        // Stop just inside the line's end so it stays on screen to read.
        v.pause();
        v.currentTime = Math.max(0, (primary.cues[prevIdx].end + off - 40) / 1000);
        pausedAt = prevIdx;
        prev = v.currentTime * 1000;
        return;
      }
      prev = t;
      prevIdx = idx;
      setCurrent(idx);
      setSecondCurrent(second ? cueIndexAt(second.cues, t, 0) : -1);
      if (!v.paused) raf = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(raf);
      // A seek isn't playback: start the crossing check from where we landed.
      prev = v.currentTime * 1000;
      prevIdx = cueIndexAt(primary.cues, prev, offsetRef.current);
      tick();
    };
    // timeupdate (~4×/s) keeps things moving when animation frames don't run,
    // e.g. a background tab. It's playback, so it doesn't reset `prev`.
    const onTime = () => {
      cancelAnimationFrame(raf);
      tick();
    };
    // Any seek (scrub, prev/next, replay) isn't playback: mark it so a short
    // jump across a line's end never counts as "the line finished".
    const onSeeking = () => {
      prev = Infinity;
    };
    const events = ["play", "seeked", "loadedmetadata"];
    events.forEach((e) => v.addEventListener(e, restart));
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("seeking", onSeeking);
    restart();
    return () => {
      cancelAnimationFrame(raf);
      events.forEach((e) => v.removeEventListener(e, restart));
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("seeking", onSeeking);
    };
  }, [video, primary, second, offset]);

  // Speed applies to every new video too.
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed, video]);

  function seekToCue(i) {
    const v = videoRef.current;
    if (!v || !primary || i < 0 || i >= primary.cues.length) return;
    v.currentTime = Math.max(0, (primary.cues[i].start + offset) / 1000);
  }

  const nowMs = () => (videoRef.current?.currentTime || 0) * 1000;

  function replay() {
    if (!primary) return;
    seekToCue(nearestCueIndex(primary.cues, nowMs(), offset));
    videoRef.current?.play();
  }

  function step(dir) {
    if (!primary) return;
    const i = nearestCueIndex(primary.cues, nowMs(), offset) + dir;
    seekToCue(Math.min(primary.cues.length - 1, Math.max(0, i)));
  }

  const nudge = (delta) => setOffset((o) => o + delta);
  // "Line up a line": freeze the next line to appear, then the learner presses
  // Now when they hear it spoken.
  const [syncTarget, setSyncTarget] = useState(null);
  const startSync = () => primary && setSyncTarget(nextCueIndex(primary.cues, nowMs(), offset));
  function syncNow() {
    setOffset(alignOffset(primary.cues[syncTarget], nowMs()));
    setSyncTarget(null);
  }

  function download() {
    const blob = new Blob([writeSrt(primary.cues, offset)], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${primary.name.replace(/\.[^.]+$/, "")}-fixed.srt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (v) v.paused ? v.play() : v.pause();
  }

  // Keyboard shortcuts, only while Watch is showing and never while typing.
  const keysRef = useRef(null);
  keysRef.current = { togglePlay, replay, step, nudge };
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      // A keyboard-focused control keeps Space for itself (words excepted, so
      // Space after tapping a word carries on playing).
      if (e.key === " " && (el.tagName === "A" || (el.tagName === "BUTTON" && !el.classList.contains("word")))) return;
      const k = keysRef.current;
      const actions = {
        " ": k.togglePlay,
        r: k.replay,
        R: k.replay,
        ArrowLeft: () => k.step(-1),
        ArrowRight: () => k.step(1),
        "[": () => k.nudge(-100),
        "]": () => k.nudge(100),
        "?": () => setHelpOpen((o) => !o),
      };
      const action = actions[e.key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

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
          <WatchControls
            onReplay={replay}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            speed={speed}
            onSpeed={(s) => setWatchSettings({ speed: s })}
            autoPause={autoPause}
            onAutoPause={(on) => setWatchSettings({ autoPause: on })}
            offsetMs={offset}
            onNudge={nudge}
            onLineUp={startSync}
            syncText={syncTarget !== null ? primary.cues[syncTarget].text.replace(/\n/g, "") : null}
            onSyncNow={syncNow}
            onSyncCancel={() => setSyncTarget(null)}
            onDownload={download}
            hasSecondLine={Boolean(second)}
            showSecondLine={showSecondLine}
            onToggleSecondLine={() => setWatchSettings({ showSecondLine: !showSecondLine })}
            onHelp={() => setHelpOpen((o) => !o)}
          />
        )}

        {helpOpen && (
          <div className="watch-help" role="region" aria-label="Keyboard shortcuts">
            <dl>
              {SHORTCUTS.map(([key, what]) => (
                <div key={key}>
                  <dt>
                    <kbd>{key}</kbd>
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
            <button className="btn btn--quiet" onClick={() => setHelpOpen(false)}>
              Close
            </button>
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
