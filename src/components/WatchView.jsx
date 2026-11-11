import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getTokenizer, tokenizeWithReadings, JAPANESE_REGEX } from "../lib/furigana";
import { readSubtitleFile, isVideoFile } from "../lib/subtitles/loadFile";
import {
  alignOffset,
  createAutoPause,
  cueIndexAt,
  nearestCueIndex,
  nextCueIndex,
  pickPrimary,
} from "../lib/subtitles/cues";
import { writeSrt } from "../lib/subtitles/write";
import { ankiMode, useDueWords, useStore } from "../lib/store";
import { addedThisWeek, greeting } from "../lib/greeting";
import Ticks from "./Ticks";
import TokenLine from "./TokenLine";
import WordPanel from "./WordPanel";
import WatchDrop from "./WatchDrop";
import WatchControls, { SHORTCUTS, noFocus } from "./WatchControls";
import WatchTips from "./WatchTips";
import Transcript from "./Transcript";
import MakeSubtitles from "./MakeSubtitles";
import { transcriptKey } from "../lib/transcribe/state";
import { useTranscribe } from "../lib/transcribe/useTranscribe";
import { SAMPLE, sampleFiles } from "../lib/firstRun";
import Icon from "./Icon";
import { conjugationParts } from "../lib/conjugation";
import { captureFrame, putImage } from "../lib/images";
import { wordState } from "../lib/store";
import { isRecording } from "../lib/media/clip";

const NO_LINES = "We couldn't read any lines from this file. Is it a .srt, .vtt or .ass file?";
const BAD_VIDEO = "Your browser can't play this video. MP4 files work best. Chrome and Edge play the most formats.";
const NO_SAMPLE = "The sample clip didn't load. Check your connection and try again.";

const ERRORS = {
  "cant-decode": "This browser can't read the sound in this file. Chrome or Edge work best, or convert it to MP4.",
  "model-download": "Couldn't download the speech model. Check your connection and try again.",
  storage: "Your browser is out of storage space for the speech model (needs about 600 MB).",
  "no-audio": "This video has no sound track to listen to.",
  unknown: "Something went wrong making subtitles. Try again.",
};

const hasJapanese = (cues) => cues.some((c) => JAPANESE_REGEX.test(c.text));

// The learner's own video + subtitle files, played locally. The current line
// renders through TokenLine (furigana, tappable words) and words open the same
// WordPanel as Read, so saved words land in Review.
export default function WatchView({ active, onOpenSettings }) {
  const { state, setWatchSettings } = useStore();
  const { size } = state.settings;
  const { showSecondLine, autoPause, speed } = state.settings.watch;
  const autoPauseRef = useRef(autoPause);
  autoPauseRef.current = autoPause;
  // Lives across effect re-runs (e.g. a timing nudge) so a just-paused line stays handled.
  const pauseTracker = useRef(null);
  if (!pauseTracker.current) pauseTracker.current = createAutoPause();
  const [helpOpen, setHelpOpen] = useState(false);

  const videoRef = useRef(null);
  const [video, setVideo] = useState(null); // { url, name, file }
  const [videoError, setVideoError] = useState(false);
  const [primary, setPrimary] = useState(null); // { name, cues, skipped }
  const [second, setSecond] = useState(null);
  const [fileError, setFileError] = useState("");
  const [sample, setSample] = useState("off"); // off | loading | on

  const [tokens, setTokens] = useState([]); // per primary cue: token[] | null
  const [readings, setReadings] = useState("idle"); // idle | loading | ready | error
  const [retry, setRetry] = useState(0);

  const t = useTranscribe(video?.file ?? null);
  const [card, setCard] = useState(false); // first-use download notice
  const [pastEnd, setPastEnd] = useState(false); // playhead is past the last line made so far

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

  // Transcribed lines flow into the primary / second line as they arrive, but
  // never over a subtitle file the learner loaded by hand. loadPrimary only for
  // the first batch, so offset, selection and auto-pause survive later batches.
  useEffect(() => {
    const file = video?.file ?? null;
    // Only sync a record that belongs to this video (the hook loads it after the file changes).
    if (!file || t.recordKey !== transcriptKey(file)) return;
    const { ja, en } = t.record;
    if (primary && !primary.auto) return;
    if (ja.length && !primary) loadPrimary({ name: `${video.name} (auto)`, cues: ja, skipped: 0, auto: true });
    else if (ja.length && primary.cues !== ja) setPrimary((p) => ({ ...p, cues: ja }));
    if (en?.length && (!second || (second.auto && second.cues !== en))) {
      setSecond({ name: `${video.name} (auto English)`, cues: en, skipped: 0, auto: true });
    }
  }, [t.record, video, primary, second]);

  function loadPrimary(file) {
    pauseTracker.current = createAutoPause();
    setPrimary(file);
    setOffset(0);
    setSyncTarget(null);
    setSelection(null);
    setTokens([]);
  }

  // Back to the drop screen with nothing loaded.
  function closeVideo() {
    if (video) URL.revokeObjectURL(video.url);
    setVideo(null);
    setVideoError(false);
    setPrimary(null);
    setSecond(null);
    setTokens([]);
    setSelection(null);
    setCard(false);
    setFileError("");
    setSample("off");
  }

  // The learner's own files: the sample credit no longer applies.
  function pickFiles(list) {
    setSample("off");
    return handleFiles(list);
  }

  async function loadSample() {
    setSample("loading");
    try {
      await handleFiles(await sampleFiles());
      setSample("on");
    } catch {
      setSample("off");
      setFileError(NO_SAMPLE);
    }
  }

  async function handleFiles(list) {
    const files = [...list];
    if (!files.length) return;
    setFileError("");

    const vid = files.find(isVideoFile);
    if (vid) {
      setVideo({ url: URL.createObjectURL(vid), name: vid.name, file: vid });
      setVideoError(false);
      setCard(false);
    }
    // Swapping one video for another: the old subtitles (loaded or made) belong
    // to the old video. Subtitles dropped before the first video are kept.
    const replacing = vid && (video || primary?.auto);
    if (replacing) {
      setPrimary(null);
      setTokens([]);
      setSelection(null);
      setSecond(null);
    }
    const hadPrimary = primary && !replacing;

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
    } else if (hasJapanese(good[0].cues) || !hadPrimary) {
      // A new main file is usually a new episode: the old second line won't match it.
      loadPrimary(good[0]);
      setSecond(null);
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
    const ap = pauseTracker.current;
    let raf = 0;
    let parking = false; // our own seek after an auto-pause
    const tick = () => {
      const t = v.currentTime * 1000;
      const off = offsetRef.current;
      const idx = cueIndexAt(primary.cues, t, off);
      const park = ap.tick(t, idx, primary.cues, off, autoPauseRef.current && !v.paused && !isRecording());
      if (park !== null) {
        // Stop just inside the line's end so it stays on screen to read.
        v.pause();
        parking = true;
        v.currentTime = park / 1000;
        return;
      }
      setCurrent(idx);
      setPastEnd(primary.cues.length > 0 && t > primary.cues[primary.cues.length - 1].end + off);
      setSecondCurrent(second ? cueIndexAt(second.cues, t, 0) : -1);
      if (!v.paused) raf = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(raf);
      const t = v.currentTime * 1000;
      ap.seeked(t, cueIndexAt(primary.cues, t, offsetRef.current));
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
      ap.seeking(parking);
      parking = false;
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

  function makeSubtitles() {
    if (t.needsModelOk) setCard(true);
    else t.start();
  }

  function download() {
    const blob = new Blob([writeSrt(primary.cues, offset)], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${primary.name.replace(/\.[^.]+$/, "")}-fixed.srt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Focus mode: real fullscreen of the whole tab (so the word card still shows),
  // or a full-window layout where element fullscreen isn't allowed (iPhone).
  const rootRef = useRef(null);
  // Phones show the transcript under the player by default (it fills the
  // space below the controls); wider screens show it beside the video anyway.
  const [transcriptOpen, setTranscriptOpen] = useState(() => window.matchMedia?.("(max-width: 719px)").matches ?? false);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    const sync = () => setFocus(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  function toggleFocus() {
    const el = rootRef.current;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (focus) setFocus(false);
    else if (document.fullscreenEnabled && el?.requestFullscreen) el.requestFullscreen().catch(() => setFocus(true));
    else setFocus(true);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (v) v.paused ? v.play() : v.pause();
  }

  // Keyboard shortcuts, only while Watch is showing and never while typing.
  const keysRef = useRef(null);
  keysRef.current = { togglePlay, replay, step, nudge, toggleFocus, focus };
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      // A control reached by keyboard keeps Space for itself. After a mouse
      // click (no :focus-visible) Space means play/pause, as do word buttons.
      const control = el.tagName === "A" || (el.tagName === "BUTTON" && !el.classList.contains("word"));
      if (e.key === " " && control && el.matches(":focus-visible")) return;
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
        f: k.toggleFocus,
        F: k.toggleFocus,
      };
      // Esc leaves the full-window fallback (real fullscreen handles Esc itself).
      if (e.key === "Escape" && k.focus && !document.fullscreenElement) actions.Escape = k.toggleFocus;
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

  // The word card sits above the tapped word (desktop); keep it on screen.
  const linesRef = useRef(null);
  const [anchorX, setAnchorX] = useState(0);
  useLayoutEffect(() => {
    const box = linesRef.current;
    const word = box?.querySelector(".word[aria-pressed='true']");
    if (!box || !word) return;
    const b = box.getBoundingClientRect();
    const w = word.getBoundingClientRect();
    const half = 170;
    setAnchorX(Math.min(Math.max(w.left + w.width / 2 - b.left, half), Math.max(half, b.width - half)));
  }, [selection, current]);

  // Not-yet-known words per line (transcript dots, tick heights), plus how much
  // of the episode is already known and how many different new words it holds.
  const { newCounts, coverage, newWords } = useMemo(() => {
    let all = 0;
    let known = 0;
    const fresh = new Set();
    const counts = tokens.map((line) => {
      let n = 0;
      for (const t of line || []) {
        if (!t.isWord) continue;
        all++;
        if (wordState(state, t.base) === "known") known++;
        else {
          n++;
          fresh.add(t.base);
        }
      }
      return n;
    });
    return { newCounts: counts, coverage: all ? Math.round((known / all) * 100) : null, newWords: fresh.size };
  }, [tokens, state]);

  const due = useDueWords();
  const knownCount = new Set([...Object.keys(state.known), ...Object.keys(state.anki.known)]).size;
  const week = addedThisWeek(state);
  const showReview = !ankiMode(state);

  const ready = Boolean(video && primary);
  const busy = t.status === "loading-model" || t.status === "running";
  const canMake = Boolean(video) && t.loaded && !primary && !busy && !t.record.ja.length && !t.record.done;
  const listening = t.status === "running" && t.task === "transcribe" && pastEnd;
  const cue = primary && current !== -1 ? primary.cues[current] : null;
  const lineTokens = current !== -1 ? tokens[current] : null;
  const secondCue = second && showSecondLine && secondCurrent !== -1 ? second.cues[secondCurrent] : null;
  const selectedToken = selection ? tokens[selection.cue]?.[selection.token] : null;

  // What the Anki card needs from the line the word came from.
  function ankiContext() {
    const c = primary.cues[selection.cue];
    const sc = second ? second.cues[cueIndexAt(second.cues, c.start + offset, 0)] : null;
    return {
      sentence: c.text.replace(/\n/g, ""),
      tokens: tokens[selection.cue],
      tokenIndex: selection.token,
      translation: sc ? sc.text.replace(/\n/g, " ") : "",
      fileName: video.name,
      timeMs: c.start,
      video: videoRef.current,
      cue: c,
      offsetMs: offset,
    };
  }

  return (
    <div
      ref={rootRef}
      className={`watch ${ready ? "watch--ready" : ""} ${focus ? "watch--focus" : ""} ${transcriptOpen ? "watch--transcript-open" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        pickFiles(e.dataTransfer.files);
      }}
    >
      {!ready && (
        <WatchDrop
          onFiles={pickFiles}
          onSample={loadSample}
          onMakeSubtitles={canMake ? makeSubtitles : undefined}
          sampleLoading={sample === "loading"}
          hasVideo={Boolean(video)}
          hasSubs={Boolean(primary)}
          error={fileError || (videoError ? BAD_VIDEO : "")}
        />
      )}

      {!focus && (
        <header className="watch__top">
          <p className="watch__hello" lang="ja">
            {greeting(new Date(), state.settings.name)}
          </p>
          <p className="watch__progress">
            {knownCount} words known · {week} this week
          </p>
        </header>
      )}

      {video && (
        <div className="watch__main">
        <section className="watch__stage" aria-label="Player">
          {!focus && (
            <button className="watch__close" onMouseDown={noFocus} onClick={closeVideo}>
              <Icon name="prev" size={16} /> Close video
            </button>
          )}
          <div className="watch__frame">
            <video
              ref={videoRef}
              className="watch__video"
              src={video.url}
              controls
              // The player's own fullscreen/PiP would hide the subtitle lines;
              // Focus mode is the way to go big.
              controlsList="nofullscreen"
              disablePictureInPicture
              playsInline
              onError={() => setVideoError(true)}
            />
          </div>

          {ready && <Ticks counts={newCounts} total={primary.cues.length} current={current} onSeek={seekToCue} />}

          {primary && (
            <div className="watch__lines" ref={linesRef} style={{ "--read-size": `${size}px` }}>
              <p className="watch__line" lang="ja" aria-live="polite">
                {!cue ? (
                  listening ? (
                    <span className="watch__gap">Still listening…</span>
                  ) : (
                    <span className="watch__gap" aria-hidden="true">
                      ·
                    </span>
                  )
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
              {second && showSecondLine && <p className="watch__second">{secondCue ? secondCue.text : ""}</p>}

              {selectedToken && (
                <div className="watch__card" style={{ "--anchor-x": `${anchorX}px` }}>
                  <WordPanel
                    token={selectedToken}
                    sentence={primary.cues[selection.cue].text.replace(/\n/g, "")}
                    grammar={conjugationParts(tokens[selection.cue], selection.token)}
                    ankiContext={ankiContext()}
                    onOpenSettings={onOpenSettings}
                    onSaved={(base) => captureFrame(videoRef.current).then((blob) => blob && putImage(base, blob))}
                    onClose={() => setSelection(null)}
                  />
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
              transcriptOpen={transcriptOpen}
              onToggleTranscript={() => setTranscriptOpen((o) => !o)}
              onHelp={() => setHelpOpen((o) => !o)}
              onFocus={toggleFocus}
            />
          )}

          {ready && !helpOpen && <WatchTips />}

          {helpOpen && (
            <div className="popover watch__help" role="region" aria-label="Keyboard shortcuts">
              <div className="popover__head">
                <strong>Keyboard shortcuts</strong>
                <button
                  className="icon-btn"
                  onMouseDown={noFocus}
                  onClick={() => setHelpOpen(false)}
                  aria-label="Close shortcuts"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
              <dl className="shortcuts">
                {SHORTCUTS.map(([key, what]) => (
                  <div key={key}>
                    <dt>
                      <kbd>{key}</kbd>
                    </dt>
                    <dd>{what}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

        </section>

        {ready && !focus && (
          <p className="watch__meta">
            {coverage !== null && readings === "ready" && (
              <span className="watch__cov">
                You know {coverage}% of this episode
                <span className="watch__bar" role="img" aria-label={`${coverage} percent known`}>
                  <b style={{ width: `${coverage}%` }} />
                </span>
              </span>
            )}
            {coverage !== null && readings === "ready" && (
              <span>
                {newWords} new {newWords === 1 ? "word" : "words"}
              </span>
            )}
            {primary.auto && <span className="watch__draft">Subtitles made by Mimitori · draft</span>}
          </p>
        )}

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
                  <button className="link" onMouseDown={noFocus} onClick={() => setRetry((n) => n + 1)}>
                    Try again
                  </button>
                </p>
              )}
              {t.status === "error" && t.error && (
                <p className="note note--error" role="alert">
                  {ERRORS[t.error.code] ?? ERRORS.unknown}
                </p>
              )}
              <MakeSubtitles
                t={t}
                card={card}
                onConfirm={() => {
                  setCard(false);
                  t.start();
                }}
                onCancel={() => setCard(false)}
                onDownload={primary ? download : undefined}
              />
              {primary?.skipped > 0 && <p className="note">Skipped {primary.skipped} lines we couldn't read.</p>}
              {sample === "on" && <p className="note">{SAMPLE.credit}</p>}
              {ready && <WatchDrop compact onFiles={pickFiles} />}
          </div>
        </div>
      )}

      {ready && (
        <aside className="watch__side" aria-label="Transcript">
          <div className="watch__side-head">
            <strong>Transcript</strong>
            <span>{primary.cues.length} lines</span>
          </div>
          <Transcript
            cues={primary.cues}
            current={current}
            onJump={seekToCue}
            newCounts={newCounts}
            auto={Boolean(primary.auto)}
            edited={t.record.edited}
            onEdit={t.editLine}
          />
          <div className="watch__foot">
            {showReview && (
              <p>{due.length > 0 ? `${due.length} to review today.` : "Nothing to review today."}</p>
            )}
            <p>No account. Everything stays on this computer.</p>
          </div>
        </aside>
      )}
    </div>
  );
}
