import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { openBook } from "./open.js";
import { loadPdf } from "./pdf.js";
import { makeZip } from "./zip.fixture.js";

const fixture = (name) => readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url));

function fakes() {
  const decoded = [];
  const closed = [];
  return {
    decoded,
    closed,
    deps: {
      decode: async (blob) => {
        decoded.push(blob.name ?? "entry");
        const bmp = { width: 800, height: 1200, close: () => closed.push(bmp) };
        return bmp;
      },
      loadPdf: async (file) => loadPdf(file, await import("pdfjs-dist/legacy/build/pdf.mjs")),
    },
  };
}

const withPath = (name, path, data = "x") => Object.defineProperty(new File([data], name), "webkitRelativePath", { value: path });

test("opens the fixture CBZ", async () => {
  const book = await openBook([new File([fixture("sample-book.cbz")], "sample-book.cbz")], fakes().deps);
  assert.equal(book.kind, "cbz");
  assert.equal(book.pageCount, 3);
  assert.equal(book.rtl, true);
  assert.equal(book.title, "sample-book");
  assert.equal(await book.getTextItems(1), null);
  const page = await book.getPage(1);
  assert.equal(page.width, 800);
  book.close();
});

test("opens the fixture PDF", async () => {
  const book = await openBook([new File([fixture("sample-book.pdf")], "sample-book.pdf")], fakes().deps);
  assert.equal(book.kind, "pdf");
  assert.equal(book.pageCount, 2);
  assert.equal(book.rtl, false);
  assert.deepEqual(await book.getTextItems(2), []);
  assert.ok((await book.getTextItems(1)).length > 10);
  book.close();
});

test("a folder keeps only images, in natural order", async () => {
  const f = fakes();
  const files = [withPath("10.png", "vol/10.png"), withPath("2.png", "vol/2.png"), withPath("notes.txt", "vol/notes.txt")];
  const book = await openBook(files, f.deps);
  assert.equal(book.kind, "folder");
  assert.equal(book.pageCount, 2);
  assert.equal(book.rtl, true);
  assert.equal(book.title, "vol");
  await book.getPage(1);
  assert.equal(f.decoded[0], "2.png");
});

test("unsupported types", async () => {
  await assert.rejects(openBook([new File(["x"], "x.cbr")], fakes().deps), { code: "unsupported" });
  await assert.rejects(openBook([new File(["x"], "x.epub")], fakes().deps), { code: "unsupported" });
});

test("a zip with no images has no pages", async () => {
  const zip = makeZip([{ name: "readme.txt", data: new Uint8Array([65]), method: 0 }]);
  await assert.rejects(openBook([new File([zip], "a.cbz")], fakes().deps), { code: "no-pages" });
});

test("a broken zip is broken", async () => {
  await assert.rejects(openBook([new File([new Uint8Array(300)], "a.cbz")], fakes().deps), { code: "broken" });
});

test("getPage keeps at most three decoded pages", async () => {
  const f = fakes();
  const files = [1, 2, 3, 4].map((n) => withPath(`${n}.png`, `v/${n}.png`));
  const book = await openBook(files, f.deps);
  for (const n of [1, 2, 3, 4]) await book.getPage(n);
  assert.equal(f.closed.length, 2); // pages 1 and 2 are gone; 3 and 4 are still held
  await book.close();
  assert.equal(f.closed.length, 4);
});

test("a slow older page can't close the page now showing", async () => {
  const closed = [];
  const waiting = new Map();
  const deps = {
    decode: (blob) =>
      new Promise((resolve) => {
        const bmp = { name: blob.name, width: 1, height: 1, close: () => closed.push(blob.name) };
        waiting.set(blob.name, () => resolve(bmp));
      }),
  };
  const files = [1, 2, 3].map((n) => withPath(`${n}.png`, `v/${n}.png`));
  const book = await openBook(files, deps);
  const slow = book.getPage(1); // still decoding
  const fast = book.getPage(3);
  await new Promise((r) => setTimeout(r)); // let both start decoding
  waiting.get("3.png")();
  await fast;
  waiting.get("1.png")();
  await slow;
  await new Promise((r) => setTimeout(r));
  assert.deepEqual(closed, ["1.png"]); // the old page goes; page 3 stays open
});

test("peekPage decodes without touching the pages being held", async () => {
  const f = fakes();
  const files = [1, 2, 3].map((n) => withPath(`${n}.png`, `v/${n}.png`));
  const book = await openBook(files, f.deps);
  await book.getPage(3);
  const peeked = await book.peekPage(1);
  assert.equal(peeked.width, 800);
  assert.equal(f.closed.length, 0);
  await book.getPage(3);
  assert.equal(f.decoded.filter((n) => n === "3.png").length, 1); // page 3 was still cached
});
