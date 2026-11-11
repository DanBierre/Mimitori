import { test } from "node:test";
import assert from "node:assert/strict";
import zlib from "node:zlib";
import { readFileSync } from "node:fs";
import { listEntries, readEntry } from "./zip.js";

const enc = new TextEncoder();

// Shift_JIS encoder for tests: Node has no encoder, so build a reverse map by decoding.
let sjisMap;
function sjisBytes(str) {
  if (!sjisMap) {
    sjisMap = new Map();
    const dec = new TextDecoder("shift_jis");
    for (let b = 0x20; b < 0x7f; b++) sjisMap.set(String.fromCharCode(b), [b]);
    for (let a = 0x81; a <= 0xfc; a++) {
      if (a >= 0xa0 && a <= 0xdf) continue;
      for (let b = 0x40; b <= 0xfc; b++) {
        const ch = dec.decode(new Uint8Array([a, b]));
        if (ch.length === 1 && ch !== "\ufffd" && !sjisMap.has(ch)) sjisMap.set(ch, [a, b]);
      }
    }
  }
  return Uint8Array.from([...str].flatMap((c) => sjisMap.get(c)));
}

function crc(data) {
  return zlib.crc32(data);
}

// Builds a zip by hand: local headers, central directory, end record.
function makeZip(files, comment = "", flagsOverride = 0) {
  const parts = [];
  const central = [];
  let offset = 0;
  const u16 = (n) => [n & 255, (n >> 8) & 255];
  const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const nameBytes = f.nameBytes ?? enc.encode(f.name);
    const raw = f.data;
    const body = f.method === 8 ? zlib.deflateRawSync(raw) : raw;
    const flags = (f.utf8 ? 0x800 : 0) | flagsOverride;
    const local = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(flags), ...u16(f.method), ...u16(0), ...u16(0),
      ...u32(crc(raw)), ...u32(body.length), ...u32(raw.length), ...u16(nameBytes.length), ...u16(0),
      ...nameBytes,
    ]);
    parts.push(local, body);
    central.push(Uint8Array.from([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(flags), ...u16(f.method), ...u16(0), ...u16(0),
      ...u32(crc(raw)), ...u32(body.length), ...u32(raw.length), ...u16(nameBytes.length),
      ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes,
    ]));
    offset += local.length + body.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const cm = enc.encode(comment);
  const end = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(cdSize), ...u32(offset), ...u16(cm.length), ...cm,
  ]);
  return Buffer.concat([...parts, ...central, end]);
}

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
