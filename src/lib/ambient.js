// Soft light from the video: average colour of the left and right halves of a
// tiny frame, with near-black (letterbox) pixels ignored and the result
// clamped so it never shouts. Pure: takes RGBA pixel data, returns CSS colours.

const DARK = 28; // a pixel whose brightest channel is below this counts as letterbox

// Mean [r, g, b] of columns x0..x1-1, or null when nothing but black is there.
export function averageColumns(data, w, h, x0, x1) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      if (Math.max(data[i], data[i + 1], data[i + 2]) < DARK) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n++;
    }
  }
  return n ? [r / n, g / n, b / n] : null;
}

// Cap saturation and keep lightness in a calm middle band.
export function soften([r, g, b], maxSat = 0.55, minL = 0.28, maxL = 0.6) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let l = (mx + mn) / 2;
  const d = mx - mn;
  let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d + 6) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  s = Math.min(s, maxSat);
  l = Math.min(Math.max(l, minL), maxL);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h) % 6];
  return [r1 + m, g1 + m, b1 + m].map((v) => Math.round(v * 255));
}

const css = (rgb) => (rgb ? `rgb(${soften(rgb).join(" ")})` : "transparent");

// { l, r } CSS colours for the left and right halves; "transparent" for a black side.
export function ambientColours(data, w, h) {
  const mid = Math.floor(w / 2);
  return { l: css(averageColumns(data, w, h, 0, mid)), r: css(averageColumns(data, w, h, mid, w)) };
}

// Draws the video into a 16x9 canvas and returns the colours, or null if the
// canvas can't be read (tainted) or there's no picture yet.
const W = 16, H = 9;
let canvas;
export function sampleVideo(video) {
  if (!video?.videoWidth) return null;
  canvas ||= Object.assign(document.createElement("canvas"), { width: W, height: H });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, W, H);
  return ambientColours(ctx.getImageData(0, 0, W, H).data, W, H);
}
