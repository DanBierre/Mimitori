import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

const post = (body) =>
  worker.fetch(new Request("https://x/", { method: "POST", body: JSON.stringify(body) }), { DEEPL_API_KEY: "k:fx" });

test("worker: a non-string text is a 400, not a crash", async () => {
  for (const text of [123, { a: 1 }, ["x"], null, ""]) assert.equal((await post({ text })).status, 400);
});

test("worker: text over the cap is a 413", async () => {
  assert.equal((await post({ text: "あ".repeat(2001) })).status, 413);
});

test("worker: short text goes on to DeepL", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ translations: [{ text: "hi" }] }));
  try {
    assert.equal((await post({ text: "こんにちは" })).status, 200);
  } finally {
    globalThis.fetch = real;
  }
});
