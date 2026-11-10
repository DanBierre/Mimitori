// Records a subtitle line's audio by replaying it once from the learner's own
// local video. We can't decode the file directly (it's just a blob: URL on a
// playing <video>), so we capture the element's output while it plays the line.

const MIME = "audio/webm;codecs=opus";
const LEAD_MS = 200; // start a bit early so the line isn't clipped
const TAIL_MS = 300; // keep a bit after the line ends
const MIN_BYTES = 1024;

function waitFor(target, event) {
  return new Promise((resolve) => target.addEventListener(event, resolve, { once: true }));
}

export async function recordLine(video, startMs, endMs) {
  const capture = video.captureStream || video.mozCaptureStream;
  if (!capture || typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported(MIME)) {
    return null;
  }

  const saved = {
    time: video.currentTime,
    muted: video.muted,
    volume: video.volume,
    paused: video.paused,
  };

  try {
    // A muted element can yield a silent captured track, so unmute for the replay.
    video.muted = false;
    video.pause();
    const seeked = waitFor(video, "seeked");
    video.currentTime = Math.max(0, startMs - LEAD_MS) / 1000;
    await seeked;

    const audioTracks = capture.call(video).getAudioTracks();
    if (audioTracks.length === 0) return null;
    const recorder = new MediaRecorder(new MediaStream(audioTracks), { mimeType: MIME });
    const chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = waitFor(recorder, "stop");

    recorder.start();
    await video.play();
    await new Promise((resolve) => {
      const stopAt = endMs + TAIL_MS;
      // Safety net so a stalled video can't hang us.
      const bail = setTimeout(done, endMs - startMs + 3000);
      let raf;
      function done() {
        clearTimeout(bail);
        cancelAnimationFrame(raf);
        resolve();
      }
      // rAF, not timeupdate: timeupdate only fires ~4x a second.
      function check() {
        if (video.currentTime * 1000 >= stopAt || video.ended) done();
        else raf = requestAnimationFrame(check);
      }
      check();
    });
    video.pause();
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;

    const blob = new Blob(chunks, { type: MIME });
    return blob.size >= MIN_BYTES ? blob : null;
  } finally {
    video.pause();
    video.currentTime = saved.time;
    video.muted = saved.muted;
    video.volume = saved.volume;
    if (!saved.paused) video.play().catch(() => {});
  }
}
