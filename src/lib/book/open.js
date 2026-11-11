// Turns picked files into a Book: { key, title, kind, pageCount, rtl, getPage(n), peekPage(n), getTextItems(n), close() }.
// Pages are 1-based. getPage resolves to { source, width, height }; getTextItems is null for image books.
import { listEntries, readEntry } from "./zip.js";
import { isImageName, pickPages } from "./pages.js";
import { bookKey, bookTitle } from "./store.js";
import { loadPdf } from "./pdf.js";

const fail = (code, message) => Object.assign(new Error(message), { code });
const ext = (name) => name.split(".").pop().toLowerCase();
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif" };
const defaults = { decode: (blob) => createImageBitmap(blob), loadPdf };

export async function openBook(files, deps = {}) {
  const d = { ...defaults, ...deps };
  const key = bookKey(files);
  const title = bookTitle(files);
  const one = files.length === 1 ? files[0] : null;
  const e = one ? ext(one.name) : "";

  let kind;
  let rtl = true;
  let count;
  let loadBlob; // (n) => Promise<Blob>
  let pdf = null;

  if (one && e === "pdf") {
    kind = "pdf";
    rtl = false;
    pdf = await d.loadPdf(one);
    count = pdf.pageCount;
  } else if (one && (e === "cbz" || e === "zip")) {
    kind = "cbz";
    let entries;
    try {
      entries = pickPages(await listEntries(one), (x) => x.name);
    } catch (err) {
      throw fail(err.code === "encrypted" ? "password" : "broken", err.message);
    }
    count = entries.length;
    loadBlob = async (n) => {
      const entry = entries[n - 1];
      return new Blob([await readEntry(one, entry)], { type: MIME[ext(entry.name)] });
    };
  } else if (!one || isImageName(one.name)) {
    kind = "folder";
    const pages = pickPages(files, (f) => f.webkitRelativePath || f.name);
    count = pages.length;
    loadBlob = async (n) => pages[n - 1];
  } else {
    throw fail("unsupported", `Can't open .${e} files`);
  }
  if (!count) {
    pdf?.destroy();
    throw fail("no-pages", "No pages found");
  }

  // Keep the decoded pages n-1..n+1; close the rest.
  const cache = new Map();
  const closePage = (p) => p.then((pg) => pg.source.close?.(), () => {});
  const load = async (n) => {
    if (pdf) return pdf.render(n);
    const bitmap = await d.decode(await loadBlob(n));
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  };

  return {
    key,
    title,
    kind,
    pageCount: count,
    rtl,
    getPage(n) {
      // Evict against the page asked for now, at call time: a slow older decode finishing later must not close the page on show.
      // A pending page that gets evicted is closed when it finishes; nobody waits for that.
      for (const [k, p] of cache) {
        if (Math.abs(k - n) > 1) {
          cache.delete(k);
          closePage(p);
        }
      }
      if (!cache.has(n)) {
        const p = load(n);
        cache.set(n, p);
        p.catch(() => cache.get(n) === p && cache.delete(n)); // a failed page can be tried again
      }
      return cache.get(n);
    },
    // A page decoded on the side (a cover): not cached, nothing evicted. The caller closes page.source when done.
    peekPage: (n) => load(n),
    getTextItems: async (n) => (pdf ? pdf.textItems(n) : null),
    async close() {
      const all = [...cache.values()].map(closePage);
      cache.clear();
      await Promise.all(all);
      pdf?.destroy();
    },
  };
}
