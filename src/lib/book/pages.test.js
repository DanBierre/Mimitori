import { test } from "node:test";
import assert from "node:assert/strict";
import { pickPages } from "./pages.js";

const id = (x) => x;

test("sorts naturally", () => {
  assert.deepEqual(pickPages(["10.jpg", "2.jpg", "1.jpg"], id), ["1.jpg", "2.jpg", "10.jpg"]);
});

test("sorts by full path", () => {
  assert.deepEqual(
    pickPages(["ch2/1.jpg", "ch1/10.jpg", "ch1/2.jpg"], id),
    ["ch1/2.jpg", "ch1/10.jpg", "ch2/1.jpg"],
  );
});

test("drops non-images and junk", () => {
  assert.deepEqual(
    pickPages(["vol.mokuro", "notes.txt", "Thumbs.db", "__MACOSX/._1.jpg", ".hidden.png", "a/001.PNG"], id),
    ["a/001.PNG"],
  );
});
