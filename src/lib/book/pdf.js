// pdf.js wrapper. pdfjs-dist loads only when a PDF opens, and never at import time (so Node tests can import this file).
// Item = { str, box: [x0, y0, x1, y1], vertical }, box in fractions of the page.

const fail = (code, message) => Object.assign(new Error(message), { code });

// Chromium and some other tools write vertical Japanese as upright single characters on a horizontal font,
// so pdf.js doesn't flag them. A single character with another single character just above or below it, in the
// same column, counts as vertical. O(n²) over one page's items, fine for a page of text.
function inferVertical(items) {
  const w = (i) => i.box[2] - i.box[0];
  const h = (i) => i.box[3] - i.box[1];
  const cx = (i) => (i.box[0] + i.box[2]) / 2;
  const cy = (i) => (i.box[1] + i.box[3]) / 2;
  const single = items.filter((i) => [...i.str].length === 1 && !i.vertical);
  for (const a of single) {
    a.vertical = single.some((b) => {
      if (b === a) return false;
      const dx = Math.abs(cx(a) - cx(b));
      const dy = Math.abs(cy(a) - cy(b));
      return dx < Math.max(w(a), w(b)) && dy > dx && dy <= 1.6 * Math.max(h(a), h(b));
    });
  }
}

// Vertical writing makes fonts map punctuation to presentation forms (︑ for 、, ︙ for …); give back the normal characters.
const cleanStr = (s) =>
  s.replace(/\s+/g, "").replace(/[\uFE10-\uFE19\uFE30-\uFE44]/g, (c) => (c === "\uFE19" ? "\u2026" : c.normalize("NFKC")));

export function normalizeItems(items, styles, viewport) {
  const out = [];
  for (const it of items) {
    const str = cleanStr(it.str);
    if (!str) continue;
    const [, , , , e, f] = it.transform;
    const [ax, ay] = viewport.convertToViewportPoint(e, f);
    const [bx, by] = viewport.convertToViewportPoint(e + it.width, f + it.height);
    out.push({
      str,
      box: [Math.min(ax, bx) / viewport.width, Math.min(ay, by) / viewport.height, Math.max(ax, bx) / viewport.width, Math.max(ay, by) / viewport.height],
      vertical: styles?.[it.fontName]?.vertical === true,
    });
  }
  inferVertical(out);
  return out;
}

// PdfDoc = { pageCount, render(n, maxSide), textItems(n), destroy() }. Pages are 1-based.
// `pdfjsLib` is for tests, which pass their own Node build.
export async function loadPdf(file, pdfjsLib) {
  let lib = pdfjsLib;
  if (!lib) {
    lib = await import("pdfjs-dist");
    lib.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  }
  let doc;
  let task;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    task = lib.getDocument({
      data,
      cMapUrl: "/pdfjs/cmaps/",
      cMapPacked: true,
      standardFontDataUrl: "/pdfjs/standard_fonts/",
      wasmUrl: "/pdfjs/wasm/",
    });
    doc = await task.promise;
  } catch (e) {
    throw fail(e?.name === "PasswordException" ? "password" : "broken", e?.message || "Couldn't open the PDF");
  }
  return {
    pageCount: doc.numPages,
    async render(n, maxSide = 4096) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(2, maxSide / Math.max(base.width, base.height)) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      page.cleanup();
      return { source: canvas, width: canvas.width, height: canvas.height };
    },
    async textItems(n) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      return normalizeItems(content.items, content.styles, page.getViewport({ scale: 1 }));
    },
    destroy: () => task.destroy(),
  };
}
