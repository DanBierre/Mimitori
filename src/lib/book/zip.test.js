import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { listEntries, readEntry } from "./zip.js";
import { makeZip, sjisBytes } from "./zip.fixture.js";

const bytes = (n, seed) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + seed) & 255);
const A = bytes(300, 1);
const B = bytes(500, 2);
const two = () => makeZip([
  { name: "001.png", data: A, method: 0 },
  { name: "002.png", data: B, method: 8 },
]);

test("lists stored and deflated entries", async () => {
  const es = await listEntries(new Blob([two()]));
  assert.deepEqual(es.map((e) => e.name), ["001.png", "002.png"]);
  assert.deepEqual(es.map((e) => e.method), [0, 8]);
  assert.deepEqual(es.map((e) => e.size), [300, 500]);
});

test("reads both entries back byte for byte", async () => {
  const blob = new Blob([two()]);
  const es = await listEntries(blob);
  assert.deepEqual(await readEntry(blob, es[0]), A);
  assert.deepEqual(await readEntry(blob, es[1]), B);
});

test("finds the end record behind a zip comment", async () => {
  const z = makeZip([{ name: "a.png", data: A, method: 0 }], "x".repeat(200));
  const es = await listEntries(new Blob([z]));
  assert.equal(es.length, 1);
});

test("skips directory entries", async () => {
  const z = makeZip([
    { name: "ch1/", data: new Uint8Array(0), method: 0 },
    { name: "ch1/001.png", data: A, method: 0 },
  ]);
  const es = await listEntries(new Blob([z]));
  assert.deepEqual(es.map((e) => e.name), ["ch1/001.png"]);
});

test("decodes UTF-8 names with flag 11", async () => {
  const z = makeZip([{ name: "第1話/001.png", data: A, method: 0, utf8: true }]);
  const es = await listEntries(new Blob([z]));
  assert.equal(es[0].name, "第1話/001.png");
});

test("decodes Shift_JIS names without flag 11", async () => {
  const z = makeZip([{ name: "x", nameBytes: sjisBytes("第1話/001.png"), data: A, method: 0 }]);
  const es = await listEntries(new Blob([z]));
  assert.equal(es[0].name, "第1話/001.png");
});

test("works on a Blob that refuses whole-file reads", async () => {
  class Picky extends Blob {
    arrayBuffer() { throw new Error("no whole-file reads"); }
    slice(...a) { return new Blob([super.slice(...a)]); }
  }
  const blob = new Picky([two()]);
  const es = await listEntries(blob);
  assert.equal(es.length, 2);
  assert.deepEqual(await readEntry(blob, es[1]), B);
});

test("throws not-zip on random bytes", async () => {
  await assert.rejects(listEntries(new Blob([bytes(400, 9)])), { code: "not-zip" });
});

test("throws encrypted when flag bit 0 is set", async () => {
  const z = makeZip([{ name: "a.png", data: A, method: 0 }], "", 1);
  await assert.rejects(listEntries(new Blob([z])), { code: "encrypted" });
});

test("reads the real fixture CBZ", async () => {
  const blob = new Blob([readFileSync(new URL("../../../fixtures/sample-book.cbz", import.meta.url))]);
  const es = await listEntries(blob);
  assert.equal(es.length, 3);
  assert.ok(es.every((e) => e.name.endsWith(".png")));
  const head = await readEntry(blob, es[0]);
  assert.deepEqual([...head.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});
