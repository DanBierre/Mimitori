// Pure audio maths for the transcription worker (no DOM, no Web Audio).

export function downmix(planes) {
  const n = planes[0].length;
  const out = new Float32Array(n);
  for (const p of planes) for (let i = 0; i < n; i++) out[i] += p[i];
  for (let i = 0; i < n; i++) out[i] /= planes.length;
  return out;
}

// Box filter (anti-alias) then linear interpolation.
export function resample(samples, fromRate, toRate = 16000) {
  if (fromRate === toRate) return samples;
  const n = samples.length;
  const w = Math.max(1, Math.round(fromRate / toRate));
  const pre = new Float32Array(n + 1); // prefix sums
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + samples[i];
  const half = Math.floor(w / 2);
  const smooth = (i) => {
    const a = Math.max(0, i - half);
    const b = Math.min(n, a + w);
    return (pre[b] - pre[a]) / (b - a);
  };
  const len = Math.round((n * toRate) / fromRate);
  const out = new Float32Array(len);
  const ratio = fromRate / toRate;
  for (let i = 0; i < len; i++) {
    const pos = i * ratio;
    const i0 = Math.min(Math.floor(pos), n - 1);
    const i1 = Math.min(i0 + 1, n - 1);
    const f = pos - i0;
    out[i] = smooth(i0) * (1 - f) + smooth(i1) * f;
  }
  return out;
}

export function rms(samples, from = 0, to = samples.length) {
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (to - from));
}

// Centre of the quietest 100 ms block in [targetS - searchS, targetS].
export function pickCut(samples, rate, targetS, searchS) {
  if (samples.length < targetS * rate) return samples.length;
  const block = Math.round(rate / 10);
  const step = Math.max(1, Math.round(rate / 100));
  const lo = Math.max(0, Math.round((targetS - searchS) * rate));
  const hi = Math.round(targetS * rate) - block;
  let best = lo;
  let bestRms = Infinity;
  for (let s = lo; s <= hi; s += step) {
    const r = rms(samples, s, s + block);
    if (r < bestRms) { bestRms = r; best = s; }
  }
  return best + Math.floor(block / 2);
}
