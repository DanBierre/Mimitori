// Box maths (pure) plus two small canvas wrappers. A Box is [x0, y0, x1, y1], fractions of the page.
const clamp = (n) => Math.min(1, Math.max(0, n));
const EPS = 1e-9;

export function normBox(a, b) {
  const x0 = clamp(Math.min(a.x, b.x));
  const x1 = clamp(Math.max(a.x, b.x));
  const y0 = clamp(Math.min(a.y, b.y));
  const y1 = clamp(Math.max(a.y, b.y));
  if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return null;
  return [x0, y0, x1, y1];
}

export function growBox([x0, y0, x1, y1], by = 0.6) {
  const dx = ((x1 - x0) * by) / 2;
  const dy = ((y1 - y0) * by) / 2;
  return [clamp(x0 - dx), clamp(y0 - dy), clamp(x1 + dx), clamp(y1 + dy)];
}

export function toPixels([x0, y0, x1, y1], w, h) {
  const sx = Math.floor(x0 * w + EPS);
  const sy = Math.floor(y0 * h + EPS);
  const ex = Math.ceil(x1 * w - EPS);
  const ey = Math.ceil(y1 * h - EPS);
  return { sx, sy, sw: Math.max(1, ex - sx), sh: Math.max(1, ey - sy) };
}

// Browser only. No DOM access at import time.
function draw(source, w, h, box, maxWidth) {
  const { sx, sy, sw, sh } = toPixels(box, w, h);
  const scale = maxWidth && sw > maxWidth ? maxWidth / sw : 1;
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const canvas = new OffscreenCanvas(dw, dh);
  canvas.getContext("2d").drawImage(source, sx, sy, sw, sh, 0, 0, dw, dh);
  return canvas;
}

// The exact box at full resolution, for the OCR worker.
export async function cropForOcr(source, w, h, box) {
  return createImageBitmap(draw(source, w, h, box));
}

// The box plus a margin, at most 480 px wide, for the Anki card.
export async function cropPicture(source, w, h, box, maxWidth = 480) {
  return draw(source, w, h, growBox(box), maxWidth).convertToBlob({ type: "image/jpeg", quality: 0.7 });
}
