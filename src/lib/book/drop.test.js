import { test } from "node:test";
import assert from "node:assert/strict";
import { filesFromDrop, pickBookFiles } from "./drop.js";
import { bookKey, bookTitle } from "./store.js";

const file = (name, size = 10) => new File([new Uint8Array(size)], name);

// Fakes of the browser's FileSystemEntry objects. Folders hand out entries in batches, like Chrome.
const fileEntry = (path) => {
  const name = path.split("/").pop();
  return { isFile: true, isDirectory: false, name, fullPath: `/${path}`, file: (ok) => ok(file(name)) };
};
const dirEntry = (path, children, batch = 2) => ({
  isFile: false,
  isDirectory: true,
  fullPath: `/${path}`,
  createReader() {
    let at = 0;
    return {
      readEntries(ok) {
        const out = children.slice(at, at + batch);
        at += batch;
        setTimeout(() => ok(out));
      },
    };
  },
});
const drop = (entries, files = []) => ({
  items: entries.map((e) => ({ kind: "file", webkitGetAsEntry: () => e })),
  files,
});

test("one dropped file comes back as itself", async () => {
  const files = await filesFromDrop(drop([fileEntry("Yotsuba 01.cbz")]));
  assert.deepEqual(files.map((f) => f.name), ["Yotsuba 01.cbz"]);
  assert.ok(!files[0].webkitRelativePath);
  assert.equal(bookTitle(files), "Yotsuba 01");
});

test("a batch of dropped files all come back", async () => {
  const files = await filesFromDrop(drop(["002.jpg", "001.jpg", "003.png"].map(fileEntry)));
  assert.deepEqual(files.map((f) => f.name), ["002.jpg", "001.jpg", "003.png"]);
});

test("a dropped folder is walked, nested folders and all, with picker-style paths", async () => {
  const vol = dirEntry("Vol 1", [
    fileEntry("Vol 1/001.jpg"),
    fileEntry("Vol 1/002.jpg"),
    fileEntry("Vol 1/003.jpg"),
    dirEntry("Vol 1/extra", [fileEntry("Vol 1/extra/010.jpg")]),
    fileEntry("Vol 1/Thumbs.db"),
  ]);
  const files = await filesFromDrop(drop([vol]));
  assert.deepEqual(
    files.map((f) => f.webkitRelativePath),
    ["Vol 1/001.jpg", "Vol 1/002.jpg", "Vol 1/003.jpg", "Vol 1/extra/010.jpg", "Vol 1/Thumbs.db"],
  );
  // Same title and key as picking the same folder with "Folder of pages".
  assert.equal(bookTitle(files), "Vol 1");
  assert.match(bookKey(files), /^Vol 1\|4\|/);
});

test("without entry support it falls back to dataTransfer.files", async () => {
  const f = file("a.pdf");
  const files = await filesFromDrop({ items: [{ kind: "file" }], files: [f] });
  assert.deepEqual(files, [f]);
});

test("dragged text (not files) gives nothing", async () => {
  assert.deepEqual(await filesFromDrop({ items: [{ kind: "string" }], files: [] }), []);
});

test("pickBookFiles keeps pages, and opens the first book when there are no pages", () => {
  const pages = [file("001.jpg"), file("notes.txt")];
  assert.equal(pickBookFiles(pages), pages);
  const one = [file("a.pdf")];
  assert.equal(pickBookFiles(one), one);
  assert.deepEqual(pickBookFiles([file("Vol 10.cbz"), file("Vol 2.cbz"), file("readme.txt")]).map((f) => f.name), ["Vol 2.cbz"]);
  const junk = [file("a.txt"), file("b.txt")];
  assert.equal(pickBookFiles(junk), junk);
});
