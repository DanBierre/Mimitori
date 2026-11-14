// Files from a drag and drop: one file, a batch of files, or whole folders of pages.
// dataTransfer.files lists a dropped folder as one empty "file", so folders are walked through their entries.
import { isImageName } from "./pages.js";

const BOOK = /\.(pdf|cbz|zip)$/i;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

// A folder's files carry their path, like the folder picker gives ("Vol 1/003.jpg"), so the book key and title match.
const withPath = (file, path) => {
  if (path && path !== file.name) Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
};

const fileOf = (entry) => new Promise((resolve, reject) => entry.file(resolve, reject));

// readEntries hands back a folder in batches (100 at a time in Chrome) until it returns none.
async function listDir(entry) {
  const reader = entry.createReader();
  const all = [];
  for (;;) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) return all;
    all.push(...batch);
  }
}

async function walk(entry) {
  if (entry.isFile) return [withPath(await fileOf(entry), entry.fullPath.replace(/^\//, ""))];
  if (!entry.isDirectory) return [];
  const nested = await Promise.all((await listDir(entry)).map(walk));
  return nested.flat();
}

export async function filesFromDrop(dt) {
  // Entries must be taken now: the browser empties the drop's items once the event handler yields.
  const entries = [...(dt?.items || [])]
    .filter((it) => it.kind === "file")
    .map((it) => it.webkitGetAsEntry?.())
    .filter(Boolean);
  if (!entries.length) return [...(dt?.files || [])];
  return (await Promise.all(entries.map(walk))).flat();
}

// What to hand to openBook. Pages win; with no pages, the first book file (by name) opens on its own,
// so a drop of a few volumes, or a folder holding one PDF, still opens something.
export function pickBookFiles(files) {
  if (files.length < 2 || files.some((f) => isImageName(f.webkitRelativePath || f.name))) return files;
  const books = files.filter((f) => BOOK.test(f.name)).sort((a, b) => collator.compare(a.name, b.name));
  return books.length ? [books[0]] : files;
}
