import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeItems } from "./pdf.js";
import { textInBox } from "./textInBox.js";

const viewport = { width: 600, height: 800, convertToViewportPoint: (x, y) => [x, 800 - y] };
const item = (str, e, f, w = 10, h = 10, fontName = "f") => ({ str, fontName, width: w, height: h, transform: [h, 0, 0, h, e, f] });

test("normalizeItems flips PDF y to page fractions", () => {
  const [out] = normalizeItems([item("あいう", 100, 700, 50, 10)], { f: {} }, viewport);
  assert.deepEqual(out.box, [100 / 600, 90 / 800, 150 / 600, 100 / 800]);
  assert.equal(out.str, "あいう");
  assert.equal(out.vertical, false);
});

test("normalizeItems drops empty items and marks vertical items from styles", () => {
  const out = normalizeItems([item("", 1, 1), item("縦", 100, 700, 10, 10, "v")], { f: {}, v: { vertical: true } }, viewport);
  assert.equal(out.length, 1);
  assert.equal(out[0].vertical, true);
});

test("normalizeItems turns vertical punctuation forms back to normal ones and drops spaces", () => {
  const out = normalizeItems([item("か ", 100, 700), item("︑", 100, 689), item("︙", 100, 678), item("﹁", 100, 667)], { f: {} }, viewport);
  assert.deepEqual(out.map((i) => i.str), ["か", "、", "…", "「"]);
});

test("normalizeItems infers vertical for single characters stacked in a column", () => {
  const stacked = [item("本", 100, 700), item("当", 100, 689), item("に", 100, 678)];
  assert.ok(normalizeItems(stacked, { f: {} }, viewport).every((i) => i.vertical));
  const sideBySide = [item("あ", 100, 700), item("い", 111, 700), item("う", 122, 700)];
  assert.ok(normalizeItems(sideBySide, { f: {} }, viewport).every((i) => !i.vertical));
  const lone = [item("あ", 100, 700)];
  assert.equal(normalizeItems(lone, { f: {} }, viewport)[0].vertical, false);
});

async function fixturePage(n) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(readFileSync(new URL("../../../fixtures/sample-book.pdf", import.meta.url)));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(n);
  const [content] = [await page.getTextContent()];
  return normalizeItems(content.items, content.styles, page.getViewport({ scale: 1 }));
}

test("reads the fixture PDF's vertical text", async () => {
  const items = await fixturePage(1);
  const text = textInBox(items, [0, 0, 1, 1]);
  const a = text.indexOf("本当に来たのか…");
  const b = text.indexOf("遅いよ、待ってたんだから");
  assert.ok(a >= 0, text);
  assert.ok(b > a, text);
  assert.ok(items.some((i) => i.vertical));
});

test("a box over one bubble reads only that bubble", async () => {
  const items = await fixturePage(1);
  const first = items.find((i) => i.str === "本");
  const [x0, y0, x1, y1] = first.box;
  assert.equal(textInBox(items, [x0 - 0.05, 0, x1 + 0.05, 0.5]), "本当に来たのか…");
});

test("fixture page 2 has no text", async () => {
  assert.deepEqual(await fixturePage(2), []);
});
