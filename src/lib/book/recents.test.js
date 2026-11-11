import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanBookRecents, loadBookRecents, coverKey, BOOK_RECENTS_KEY } from "./recents.js";

test("cleanBookRecents drops junk rows and keeps 12, newest first", () => {
  const raw = [null, { name: "no key" }, { key: "x", name: "X", page: "7", pageCount: 9, watchedAt: 1 }];
  for (let i = 0; i < 20; i++) raw.push({ key: `k${i}`, name: "n", page: 1, pageCount: 10, watchedAt: 100 + i });
  const out = cleanBookRecents(raw);
  assert.equal(out.length, 12);
  assert.equal(out[0].key, "k19");
  assert.deepEqual(cleanBookRecents([{ key: "x", name: "X", page: "7", pageCount: 9, watchedAt: 1 }])[0], {
    key: "x", name: "X", page: null, pageCount: 9, watchedAt: 1,
  });
  assert.deepEqual(cleanBookRecents("nope"), []);
});

test("loadBookRecents returns [] when storage throws", () => {
  const storage = { getItem() { throw new Error("blocked"); } };
  assert.deepEqual(loadBookRecents(storage), []);
});

test("keys", () => {
  assert.equal(BOOK_RECENTS_KEY, "mimitori:books");
  assert.equal(coverKey("a|1|2"), "book:a|1|2");
});
