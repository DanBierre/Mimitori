import test from "node:test";
import assert from "node:assert/strict";
import { createFlags, sampleFiles, SAMPLE } from "./firstRun.js";

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test("flags start unset and stay set", () => {
  const flags = createFlags(memoryStorage());
  assert.equal(flags.has("tips"), false);
  flags.set("tips");
  assert.equal(flags.has("tips"), true);
  assert.equal(flags.has("visited"), false);
});

test("flags survive a storage that throws (private mode)", () => {
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const flags = createFlags(broken);
  assert.equal(flags.has("tips"), false);
  assert.doesNotThrow(() => flags.set("tips"));
});

test("sampleFiles fetches the clip and both subtitle files as named Files", async () => {
  const asked = [];
  const fakeFetch = async (url) => {
    asked.push(url);
    return { ok: true, blob: async () => new Blob(["x"]) };
  };
  const files = await sampleFiles(fakeFetch);
  assert.deepEqual(asked, SAMPLE.files.map(([name]) => "/sample/" + name));
  assert.deepEqual(files.map((f) => f.name), SAMPLE.files.map(([name]) => name));
  assert.equal(files[0].type, "video/mp4");
});

test("sampleFiles rejects when a file is missing", async () => {
  const fakeFetch = async (url) => ({ ok: !url.endsWith(".srt"), status: 404, blob: async () => new Blob(["x"]) });
  await assert.rejects(sampleFiles(fakeFetch), /sample-ja\.srt/);
});
