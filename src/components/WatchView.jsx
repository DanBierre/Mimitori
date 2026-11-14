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
import { ankiMode, knownTotal, useReviewToday, useStore, useT } from "../lib/store";
import { addedThisWeek, greeting } from "../lib/greeting";
import Ticks from "./Ticks";
import TokenLine from "./TokenLine";
import WordPanel from "./WordPanel";
import WatchDrop from "./WatchDrop";
import WatchControls, { SHORTCUTS, noFocus } from "./WatchControls";
import WatchTips from "./WatchTips";
import WatchRecents from "./WatchRecents";
import WatchToday from "./WatchToday";
import Transcript from "./Transcript";
import Readout from "./Readout";
import MakeSubtitles from "./MakeSubtitles";
import { transcriptKey } from "../lib/transcribe/state";
import { useTranscribe } from "../lib/transcribe/useTranscribe";
import { SAMPLE, sampleFiles } from "../lib/firstRun";
import { droppedKeys, loadRecents, posterDue, posterKey, resumeAt, saveRecents, upsertRecent } from "../lib/recents";
import { sampleVideo } from "../lib/ambient";
import Icon from "./Icon";
import { conjugationParts } from "../lib/conjugation";
import { captureFrame, deleteImage, putImage } from "../lib/images";
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

const DIFFERENT = "That's a different file, so it starts from the beginning.";
const RESTING_TICKS = [6, 17, 24, 38, 52, 61, 77, 90];

// 720px up (tablet and desktop): the empty Watch is a player-shaped stage.
// 1100px up (desktop): the word's entry sits in the side column, above the transcript.
function useMedia(q) {
  const [on, setOn] = useState(() => window.matchMedia?.(q).matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const sync = () => setOn(mq.matches);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [q]);
  return on;
}

// Video time of a line, to the tenth: 4:55.2
const stamp = (ms) => {
  const s = Math.max(0, ms) / 1000;
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
};

const hasJapanese = (cues) => cues.some((c) => JAPANESE_REGEX.test(c.text));

// The learner's own video + subtitle files, played locally. The current line
// renders through TokenLine (furigana, tappable words) and words open the same
// WordPanel as Read, so saved words land in Review.
export default function WatchView({ active, onOpenSettings }) {
  const { state, setWatchSettings } = useStore();
  const tr = useT();
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

  const wide = useMedia("(min-width: 720px)");
  const desk = useMedia("(min-width: 1100px)");
  const [recents, setRecents] = useState(loadRecents);
  const pickerRef = useRef(null);
  const pending = useRef(null); // a Carry on row waiting for the learner to pick its file
  const resumeTo = useRef(null); // seconds to seek to once the picked video has loaded
  const lastPos = useRef(null); // latest { key, name, positionS, durationS } for flushing
  const lastSave = useRef(0);
  const [notice, setNotice] = useState("");

  function remember(patch) {
    setRecents((list) => {
      const next = upsertRecent(list, patch);
      saveRecents(next);
      droppedKeys(list, next).forEach((k) => deleteImage(posterKey(k))); // idempotent, so safe if React reruns this
      return next;
    });
  }

  const t = useTranscribe(video?.file ?? null);
  const [card, setCard] = useState(false); // first-use download notice
  const [pastEnd, setPastEnd] = useState(false); // playhead is past the last line made so far

  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  offsetRef.current = offset;
  const [current, setCurrent] = useState(-1);
  const [secondCurrent, setSecondCurrent] = useState(-1);
  const [selection, setSelection] = useState(null); // { cue, token }
  const resumeRef = useRef(false); // the video was playing when a word was tapped, so closing the card plays it again
  const [tipsKey, setTipsKey] = useState(0);

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
    setNotice("");
    setSample("off");
  }

  // The learner's own files: the sample credit no longer applies.
  function pickFiles(list) {
    setSample("off");
    return handleFiles(list);
  }

  async function loadSample() {
    pending.current = null;
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
      const row = pending.current;
      pending.current = null;
      const at = row ? resumeAt(row, transcriptKey(vid)) : null;
      resumeTo.current = at;
      setNotice(row && at === null && row.key !== transcriptKey(vid) ? DIFFERENT : "");
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

  // Remember where the learner got to (every ~5 s, on pause, and when the video goes away).
  // The sample clip is a new File every time, so it is never listed.
  const sampleRef = useRef(sample);
  sampleRef.current = sample;
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !video) return;
    const key = transcriptKey(video.file);
    const snap = () => {
      if (sampleRef.current !== "off" || !Number.isFinite(v.duration)) return;
      lastPos.current = { key, name: video.name, positionS: Math.floor(v.currentTime), durationS: Math.round(v.duration) };
    };
    const flush = () => {
      if (lastPos.current?.key === key) remember(lastPos.current);
    };
    // A small poster frame for the Recent list: at most every ~30 s, and on pause / close.
    let lastPoster = 0;
    const poster = (force) => {
      if (sampleRef.current !== "off" || v.readyState < 2 || !posterDue(lastPoster, Date.now(), force)) return;
      lastPoster = Date.now();
      captureFrame(v, 192, 0.6).then((blob) => blob && putImage(posterKey(key), blob));
    };
    const onTime = () => {
      snap();
      if (Date.now() - lastSave.current > 5000) {
        lastSave.current = Date.now();
        flush();
        if (!v.paused) poster(false);
      }
    };
    const onPause = () => {
      snap();
      flush();
      poster(true);
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("pause", onPause);
    window.addEventListener("beforeunload", flush);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("pause", onPause);
      window.removeEventListener("beforeunload", flush);
      flush();
      poster(true); // the frame is drawn synchronously, before the video goes away
      lastPos.current = null;
    };
  }, [video]);

  // Soft light from the video: a left and right colour about once a second while it plays,
  // and once on seek / pause. Written straight to the stage, so nothing re-renders.
  const stageRef = useRef(null);
  const ambient = state.settings.ambient !== false;
  useEffect(() => {
    const v = videoRef.current;
    const stage = stageRef.current;
    if (!ambient || !v || !stage) return;
    const set = (l, r) => {
      stage.style.setProperty("--amb-l", l);
      stage.style.setProperty("--amb-r", r);
    };
    let id = null;
    const sample = () => {
      if (document.hidden) return;
      try {
        const c = sampleVideo(v);
        if (c) set(c.l, c.r);
      } catch {
        stop(); // a tainted canvas just means no glow
        set("transparent", "transparent");
        ["seeked", "pause", "loadeddata"].forEach((e) => v.removeEventListener(e, sample));
      }
    };
    const tick = () => {
      if (!v.paused) sample();
    };
    const start = () => {
      if (id === null) id = setInterval(tick, 1000);
    };
    const stop = () => {
      clearInterval(id);
      id = null;
    };
    const onVisible = () => (document.hidden ? stop() : start());
    ["seeked", "pause", "loadeddata"].forEach((e) => v.addEventListener(e, sample));
    document.addEventListener("visibilitychange", onVisible);
    start();
    return () => {
      stop();
      ["seeked", "pause", "loadeddata"].forEach((e) => v.removeEventListener(e, sample));
      document.removeEventListener("visibilitychange", onVisible);
      set("transparent", "transparent");
    };
  }, [ambient, video]);

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
  keysRef.current = { togglePlay, replay, step, nudge, toggleFocus, focus, pick: (n) => picks[n] !== undefined && selectWord(picks[n]) };
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
      // Esc leaves the full-window fallback (real fullscreen handles Esc itself), otherwise closes the shortcuts.
      if (e.key === "Escape" && k.focus && !document.fullscreenElement) actions.Escape = k.toggleFocus;
      else if (e.key === "Escape") return setHelpOpen(false);
      // 1–9 pick the numbered words in the line.
      if (/^[1-9]$/.test(e.key)) actions[e.key] = () => k.pick(Number(e.key) - 1);
      const action = actions[e.key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  function selectWord(i) {
    if (i === null) return closeCard();
    if (!selection) resumeRef.current = Boolean(videoRef.current && !videoRef.current.paused);
    videoRef.current?.pause();
    setSelection({ cue: current, token: i });
  }

  function closeCard() {
    setSelection(null);
    if (resumeRef.current) videoRef.current?.play().catch(() => {});
    resumeRef.current = false;
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

  const today = useReviewToday();
  const knownCount = knownTotal(state);
  const week = addedThisWeek(state);
  const showReview = !ankiMode(state);

  // Coverage joins the recents row once the readings are ready.
  useEffect(() => {
    if (video && readings === "ready" && coverage !== null && sample === "off") {
      remember({ key: transcriptKey(video.file), name: video.name, coverage });
    }
  }, [video, readings, coverage]);

  const ready = Boolean(video && primary);
  const empty = !video && wide; // the player-shaped drop stage, with Recent and Today around it
  const busy = t.status === "loading-model" || t.status === "running";
  const canMake = Boolean(video) && t.loaded && !primary && !busy && !t.record.ja.length && !t.record.done;
  const listening = t.status === "running" && t.task === "transcribe" && pastEnd;
  const cue = primary && current !== -1 ? primary.cues[current] : null;
  const lineTokens = current !== -1 ? tokens[current] : null;
  const secondCue = second && showSecondLine && secondCurrent !== -1 ? second.cues[secondCurrent] : null;
  const selectedToken = selection ? tokens[selection.cue]?.[selection.token] : null;
  // Words in the line you don't know yet, numbered 1–9 on the line, in the readout and on the entry.
  const picks = (lineTokens || [])
    .flatMap((tk, i) => (tk.isWord && wordState(state, tk.base) !== "known" ? [i] : []))
    .slice(0, 9);
  const selectedNumber = selection && selection.cue === current ? picks.indexOf(selection.token) + 1 : 0;

  const entry = selectedToken && (
    <WordPanel
      token={selectedToken}
      index={selectedNumber || undefined}
      sentence={primary.cues[selection.cue].text.replace(/\n/g, "")}
      grammar={conjugationParts(tokens[selection.cue], selection.token)}
      ankiContext={ankiContext()}
      onOpenSettings={onOpenSettings}
      onSaved={(base) => captureFrame(videoRef.current).then((blob) => blob && putImage(base, blob))}
      onClose={closeCard}
    />
  );

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
      className={`watch ${ready ? "watch--ready" : ""} ${empty ? "watch--empty" : ""} ${focus ? "watch--focus" : ""} ${transcriptOpen ? "watch--transcript-open" : ""}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        pending.current = null;
        pickFiles(e.dataTransfer.files);
      }}
    >
      {!focus && (
        <header className="watch__top">
          <p className="watch__hello" lang="ja">
            {greeting(new Date(), state.settings.name)}
          </p>
          <p className="watch__progress">
            {tr("{n} words known · {w} this week", { n: knownCount, w: week })}
          </p>
        </header>
      )}

      {empty && (
        <div className="watch__main watch__main--empty">
          <section className="watch__stage watch-empty__stage" aria-label={tr("Player")}>
            <WatchDrop
              stage
              pickerRef={pickerRef}
              onChoose={() => (pending.current = null)}
              onFiles={pickFiles}
              onSample={loadSample}
              onMakeSubtitles={undefined}
              sampleLoading={sample === "loading"}
              hasVideo={false}
              hasSubs={Boolean(primary)}
              error={fileError}
            />
            <div className="ticks ticks--rest" aria-hidden="true">
              <div className="ticks__track">
                {RESTING_TICKS.map((x) => (
                  <i key={x} style={{ left: `${x}%` }} />
                ))}
              </div>
            </div>
            <p className="watch__ghost" lang="ja" aria-hidden="true">
              字幕はここに出ます
            </p>
          </section>
          <WatchRecents
            recents={recents}
            onSample={loadSample}
            sampleLoading={sample === "loading"}
            onCarryOn={(row) => {
              pending.current = row;
              pickerRef.current?.();
            }}
          />
        </div>
      )}

      {empty && <WatchToday />}

      {!ready && !empty && (
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

      {video && (
        <div className="watch__main">
        <section ref={stageRef} className={`watch__stage${ambient ? " watch__stage--amb" : ""}`} aria-label={tr("Player")}>
          {!focus && (
            <button className="watch__close" onMouseDown={noFocus} onClick={closeVideo}>
              <Icon name="prev" size={16} /> {tr("Close video")}
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
              onLoadedMetadata={(e) => {
                if (resumeTo.current !== null) {
                  e.currentTarget.currentTime = resumeTo.current;
                  resumeTo.current = null;
                }
              }}
            />
          </div>

          {ready && <Ticks counts={newCounts} cues={primary.cues} current={current} onSeek={seekToCue} />}

          {primary && (
            <div className="watch__lines" ref={linesRef} style={{ "--read-size": `${size}px` }}>
              <p className="watch__cue-meta" aria-hidden="true">
                {cue ? (
                  <>
                    <span>{stamp(cue.start + offset)}</span>
                    <span>
                      {current + 1} / {primary.cues.length}
                    </span>
                  </>
                ) : (
                  " "
                )}
              </p>
              <p className="watch__line" lang="ja" aria-live="polite">
                {!cue ? (
                  listening ? (
                    <span className="watch__gap">{tr("Still listening…")}</span>
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
                    numbered={picks}
                  />
                ) : (
                  cue.text
                )}
              </p>
              {second && showSecondLine && <p className="watch__second">{secondCue ? secondCue.text : ""}</p>}

              {entry && !(desk && !focus) && (
                <div className="watch__card" style={{ "--anchor-x": `${anchorX}px` }}>
                  {entry}
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

          {ready && !helpOpen && <WatchTips key={tipsKey} />}

          {helpOpen && (
            <div className="popover watch__help" role="region" aria-label={tr("Keyboard shortcuts")}>
              <div className="popover__head">
                <strong>{tr("Keyboard shortcuts")}</strong>
                <button
                  className="icon-btn"
                  onMouseDown={noFocus}
                  onClick={() => setHelpOpen(false)}
                  aria-label={tr("Close shortcuts")}
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
                    <dd>{tr(what)}</dd>
                  </div>
                ))}
              </dl>
              <button
                className="link watch__tips-again"
                onMouseDown={noFocus}
                onClick={() => {
                  try {
                    localStorage.removeItem("mimitori:tips");
                  } catch {
                    /* tips just won't come back */
                  }
                  setHelpOpen(false);
                  setTipsKey((k) => k + 1);
                }}
              >
                {tr("Show the tips again")}
              </button>
            </div>
          )}

        </section>

        {ready && picks.length > 0 && (
          <div className="watch__readout">
            <Readout
              tokens={lineTokens}
              picks={picks}
              selected={selection?.cue === current ? selection.token : null}
              onSelect={selectWord}
            />
            <p className="watch__keys only-fine" aria-hidden="true">
              <span>
                <kbd>{showReview ? "S" : "A"}</kbd> {showReview ? tr("save to review") : tr("add to Anki")}
              </span>
              <span>
                <kbd>K</kbd> {tr("I know it")}
              </span>
              <span>
                <kbd>1</kbd>–<kbd>9</kbd> {tr("pick a word")}
              </span>
              <span>
                <kbd>R</kbd> {tr("replay")}
              </span>
              <span>
                <kbd>←</kbd> <kbd>→</kbd> {tr("line")}
              </span>
              <span>
                <kbd>?</kbd> {tr("all keys")}
              </span>
            </p>
          </div>
        )}

        {ready && !focus && (
          <p className="watch__meta">
            {coverage !== null && readings === "ready" && (
              <span className="watch__cov">
                <span className="watch__pct">{coverage}%</span>
                <span className="watch__pct-label">{tr("known in this episode")}</span>
                <span className="watch__bar" role="img" aria-label={tr("{n} percent known", { n: coverage })}>
                  <b style={{ width: `${coverage}%` }} />
                </span>
              </span>
            )}
            {coverage !== null && readings === "ready" && (
              <span>
                {tr(newWords === 1 ? "{n} new word" : "{n} new words", { n: newWords })}
              </span>
            )}
            {primary.auto && <span className="watch__draft">{tr("Subtitles made by Mimitori · draft")}</span>}
          </p>
        )}

          <div className="watch__notes">
              {videoError && (
                <p className="note note--error" role="alert">
                  {tr(BAD_VIDEO)}
                </p>
              )}
              {fileError && (
                <p className="note note--error" role="alert">
                  {tr(fileError)}
                </p>
              )}
              {notice && <p className="note">{tr(notice)}</p>}
              {readings === "loading" && <p className="note">{tr("Loading readings…")}</p>}
              {readings === "error" && (
                <p className="note">
                  {tr("The reading engine didn’t load, so lines show without furigana.")}{" "}
                  <button className="link" onMouseDown={noFocus} onClick={() => setRetry((n) => n + 1)}>
                    {tr("Try again")}
                  </button>
                </p>
              )}
              {t.status === "error" && t.error && (
                <p className="note note--error" role="alert">
                  {tr(ERRORS[t.error.code] ?? ERRORS.unknown)}
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
              {primary?.skipped > 0 && <p className="note">{tr(primary.skipped === 1 ? "Skipped {n} line we couldn't read." : "Skipped {n} lines we couldn't read.", { n: primary.skipped })}</p>}
              {sample === "on" && <p className="note">{tr(SAMPLE.credit)}</p>}
              {ready && <WatchDrop compact onFiles={pickFiles} />}
          </div>
        </div>
      )}

      {ready && (
        <aside className="watch__side" aria-label={tr("Transcript")}>
          {entry && desk && !focus && <div className="watch__entry">{entry}</div>}
          <div className="watch__side-head">
            <strong>{tr("Transcript")}</strong>
            <span>{tr(primary.cues.length === 1 ? "{n} line" : "{n} lines", { n: primary.cues.length })}</span>
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
              <p>{tr(today.queue.length === 0 ? "Nothing to review today." : "{n} to review today.", { n: today.queue.length }) + (today.waiting > 0 ? " " + tr("The other {n} can wait.", { n: today.waiting }) : "")}</p>
            )}
            <p>{tr("No account. Everything stays on this computer.")}</p>
          </div>
        </aside>
      )}
    </div>
  );
}
