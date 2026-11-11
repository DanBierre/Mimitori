// Book records: the page you were on, direction, fit, and the lines you boxed.
import { isImageName } from "./pages.js";

// A Line is { id, box, text, from: "pdf" | "ocr", fixed }. Pages are 1-based.

const folderOf = (f) => f.webkitRelativePath?.split("/")[0] || "";

export function bookKey(files) {
  if (files.length === 1) return `${files[0].name}|${files[0].size}|${files[0].lastModified}`;
  // Only images count, so a Thumbs.db or a .mokuro file appearing doesn't turn the book into a new one.
  const images = files.filter((f) => isImageName(f.webkitRelativePath || f.name));
  const used = images.length ? images : files;
  const total = used.reduce((n, f) => n + f.size, 0);
  return `${folderOf(files[0]) || "images"}|${used.length}|${total}`;
}

export function bookTitle(files) {
  if (files.length === 1) return files[0].name.replace(/\.[^.]+$/, "");
  return folderOf(files[0]) || "images";
}

export const emptyRecord = (rtl) => ({ page: 1, rtl, fit: "height", lines: {} });

const withPage = (rec, page, list) => ({ ...rec, lines: { ...rec.lines, [page]: list } });
const pageLines = (rec, page) => rec.lines[page] || [];

export const addLine = (rec, page, line) => withPage(rec, page, [line, ...pageLines(rec, page)]);

export const updateLine = (rec, page, id, text) =>
  withPage(rec, page, pageLines(rec, page).map((l) => (l.id === id ? { ...l, text, fixed: true } : l)));

export const removeLine = (rec, page, id) => withPage(rec, page, pageLines(rec, page).filter((l) => l.id !== id));

// IndexedDB: opened on demand so Node tests never touch it. Failures resolve quietly, like transcribe/store.js.
export function openBooks() {
  const opened = new Promise((resolve, reject) => {
    const req = indexedDB.open("mimitori-books", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("books");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const run = (mode, fn) =>
    opened.then(
      (db) =>
        new Promise((resolve, reject) => {
          const req = fn(db.transaction("books", mode).objectStore("books"));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );
  return {
    async getBook(key) {
      try {
        return (await run("readonly", (s) => s.get(key))) ?? null;
      } catch {
        return null;
      }
    },
    async putBook(key, rec) {
      try {
        await run("readwrite", (s) => s.put(rec, key));
      } catch {
        /* nothing to do */
      }
    },
  };
}
