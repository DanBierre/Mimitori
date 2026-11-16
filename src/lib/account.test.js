import { test } from "node:test";
import assert from "node:assert/strict";
import { testDeps } from "../../server/testDeps.js";
import { handle } from "../../server/handler.js";
import { finishSignIn, fingerprint, pack, startSignIn, syncOnce, unpack } from "./account.js";
import { mergeState } from "./syncMerge.js";

// The app's fetch goes straight into the server's handler, with a fake database behind it.
function server() {
  const deps = testDeps();
  globalThis.fetch = async (url, init) => handle(new Request(url, init), deps);
  return deps;
}
async function signIn(deps, email = "dan@example.com") {
  await startSignIn(email);
  return (await finishSignIn(email, deps.sent.at(-1).code, "correct horse")).session;
}
// A device: its state, and the reducer's "synced" join
function device(state) {
  const d = { state, puts: 0 };
  d.sync = (token) => syncOnce(token, () => d.state, (remote) => { d.state = { ...d.state, ...mergeState(d.state, remote) }; });
  return d;
}
const word = (base, addedAt) => ({ base, addedAt, card: { due: addedAt } });

test("pack and unpack round-trip Japanese text", async () => {
  const s = { words: { 猫: word("猫", 1) }, note: "日本語".repeat(500) };
  assert.deepEqual(await unpack(await pack(s)), s);
});

test("two devices end up with each other's words, and Anki setup stays home", async () => {
  const deps = server();
  const phone = device({ words: { 猫: word("猫", 1) }, known: {}, settings: { theme: "dark", anki: { deck: "Test" } }, settingsAt: 5 });
  const laptop = device({ words: { 犬: word("犬", 2) }, known: { 魚: 3 }, settings: { anki: { deck: "Mine" } }, settingsAt: 1 });
  const a = await signIn(deps), b = await signIn(deps);
  await phone.sync(a);
  await laptop.sync(b);
  await phone.sync(a);
  for (const d of [phone, laptop]) {
    assert.deepEqual(Object.keys(d.state.words).sort(), ["犬", "猫"]);
    assert.deepEqual(Object.keys(d.state.known), ["魚"]);
    assert.equal(d.state.settings.theme, "dark");
  }
  assert.equal(laptop.state.settings.anki.deck, "Mine");
  assert.equal(fingerprint(phone.state), fingerprint(laptop.state));
});

test("a sync with nothing new doesn't write", async () => {
  const deps = server();
  const token = await signIn(deps);
  const d = device({ words: { 猫: word("猫", 1) } });
  await d.sync(token);
  const writes = () => deps.db.prepare("SELECT version FROM copies").first();
  const v = (await writes()).version;
  await d.sync(token);
  await d.sync(token);
  assert.equal((await writes()).version, v);
});

test("a removal on one device reaches the other", async () => {
  const deps = server();
  const a = await signIn(deps), b = await signIn(deps);
  const phone = device({ words: { 猫: word("猫", 1) } });
  const laptop = device({ words: {} });
  await phone.sync(a);
  await laptop.sync(b);
  assert.ok(laptop.state.words.猫);
  laptop.state = { ...laptop.state, words: {}, gone: { 猫: 9 } };
  await laptop.sync(b);
  await phone.sync(a);
  assert.equal(phone.state.words.猫, undefined);
});

test("a write from another device in between is merged, not lost", async () => {
  const deps = server();
  const a = await signIn(deps), b = await signIn(deps);
  const phone = device({ words: { 猫: word("猫", 1) } });
  await phone.sync(a);
  const laptop = device({ words: { 犬: word("犬", 2) } });
  // The laptop saves while the phone is between reading and writing
  const real = globalThis.fetch;
  let once = true;
  globalThis.fetch = async (url, init) => {
    if (once && init?.method === "PUT") {
      once = false;
      await laptop.sync(b);
    }
    return real(url, init);
  };
  phone.state = { ...phone.state, words: { ...phone.state.words, 鳥: word("鳥", 3) } };
  await phone.sync(a);
  globalThis.fetch = real;
  await laptop.sync(b);
  assert.deepEqual(Object.keys(laptop.state.words).sort(), ["犬", "猫", "鳥"]);
});

test("an ended session reports 401", async () => {
  server();
  await assert.rejects(device({}).sync("f".repeat(64)), { status: 401 });
});

test("after a sync, this device matches what the server holds, so it doesn't sync again", async () => {
  const deps = server();
  const a = await signIn(deps), b = await signIn(deps);
  await device({ settings: { theme: "dark" }, settingsAt: 9 }).sync(a);
  const laptop = device({ settings: { ink: "blue", anki: { deck: "Test" } }, settingsAt: 1 });
  const held = await laptop.sync(b);
  assert.equal(fingerprint(laptop.state), held);
});
