// Records a subtitle line's audio by replaying it once from the learner's own
// local video. We can't decode the file directly (it's just a blob: URL on a
// playing <video>), so we capture the element's output while it plays the line.

const MIME = "audio/webm;codecs=opus";
const LEAD_MS = 200; // start a bit early so the line isn't clipped
const TAIL_MS = 300; // keep a bit after the line ends
const MIN_BYTES = 1024; // anything smaller is an empty or silent capture
const SEEK_TIMEOUT_MS = 2000;

let busy = false; // one recording at a time; a second would clobber the saved state

function waitFor(target, event) {
  return new Promise((resolve) => target.addEventListener(event, resolve, { once: true }));
}

export async function recordLine(video, startMs, endMs) {
  const capture = video.captureStream || video.mozCaptureStream;
  if (!capture || typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported(MIME)) {
    return null;
  }
  if (busy) return null;
  busy = true;

  let stream;
  let recorder;
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
    const target = Math.max(0, startMs - LEAD_MS) / 1000;
    // No seek happens (so no `seeked`) when we're already there; also never wait forever.
    if (Math.abs(video.currentTime - target) >= 0.001 || video.seeking) {
      const seeked = waitFor(video, "seeked");
      video.currentTime = target;
      await Promise.race([seeked, new Promise((r) => setTimeout(r, SEEK_TIMEOUT_MS))]);
    }

    stream = capture.call(video);
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return null;
    recorder = new MediaRecorder(new MediaStream(audioTracks), { mimeType: MIME });
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
    if (recorder && recorder.state !== "inactive") recorder.stop();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    busy = false;
    video.pause();
    video.currentTime = saved.time;
    video.muted = saved.muted;
    video.volume = saved.volume;
    if (!saved.paused) video.play().catch(() => {});
  }
}
