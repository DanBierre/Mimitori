import { test } from "node:test";
import assert from "node:assert/strict";
import { bookKey, bookTitle, emptyRecord, addLine, updateLine, removeLine } from "./store.js";

const file = (name, size, lastModified, rel = "") => ({ name, size, lastModified, webkitRelativePath: rel });

test("bookKey for a file", () => {
  assert.equal(bookKey([file("風の町 1.cbz", 5000, 123)]), "風の町 1.cbz|5000|123");
});

test("bookKey for a folder", () => {
  const files = [file("001.jpg", 100, 1, "風の町 2/001.jpg"), file("002.jpg", 250, 2, "風の町 2/002.jpg")];
  assert.equal(bookKey(files), "風の町 2|2|350");
});

test("bookKey for loose images uses 'images'", () => {
  assert.equal(bookKey([file("a.jpg", 1, 1), file("b.jpg", 2, 1)]), "images|2|3");
});

test("bookTitle drops the extension for a file, uses the folder name for a folder", () => {
  assert.equal(bookTitle([file("風の町 1.cbz", 1, 1)]), "風の町 1");
  assert.equal(bookTitle([file("001.jpg", 1, 1, "風の町 2/001.jpg"), file("002.jpg", 1, 1, "風の町 2/002.jpg")]), "風の町 2");
});

test("addLine, updateLine, removeLine never mutate their input", () => {
  const rec = Object.freeze({ ...emptyRecord(true), lines: Object.freeze({}) });
  assert.deepEqual(rec, { page: 1, rtl: true, fit: "height", lines: {} });
  const l1 = { id: "a", box: [0, 0, 1, 1], text: "あ", from: "ocr", fixed: false };
  const l2 = { ...l1, id: "b", text: "い" };
  const r1 = addLine(rec, 3, l1);
  const r2 = addLine(r1, 3, l2);
  assert.deepEqual(r2.lines[3].map((l) => l.id), ["b", "a"]);
  const r3 = updateLine(r2, 3, "a", "うう");
  assert.equal(r3.lines[3][1].text, "うう");
  assert.equal(r3.lines[3][1].fixed, true);
  assert.equal(r2.lines[3][1].text, "あ");
  const r4 = removeLine(r3, 3, "b");
  assert.deepEqual(r4.lines[3].map((l) => l.id), ["a"]);
  assert.deepEqual(rec.lines, {});
});
