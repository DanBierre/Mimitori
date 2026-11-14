import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnki, AnkiError, ADDON_URL, ANKICONNECT_URL } from "./connect.js";

// fake fetch: responder(action, params) -> body; records requests
function fakeFetch(responder) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    const req = JSON.parse(opts.body);
    calls.push({ url, req });
    return { json: async () => responder(req.action, req.params) };
  };
  return { fetchImpl, calls };
}

const rejecting = async () => {
  throw new TypeError("Failed to fetch");
};

test("invoke returns result", async () => {
  const { fetchImpl, calls } = fakeFetch(() => ({ result: 6, error: null }));
  const anki = createAnki({ fetchImpl });
  assert.equal(await anki.invoke("version"), 6);
  assert.deepEqual(calls[0].req, { action: "version", version: 6, params: {} });
});

test("invoke throws anki error", async () => {
  const { fetchImpl } = fakeFetch(() => ({
    result: null,
    error: "model was not found",
  }));
  const anki = createAnki({ fetchImpl });
  await assert.rejects(anki.invoke("addNote"), (e) => {
    assert.ok(e instanceof AnkiError);
    assert.equal(e.kind, "anki");
    assert.equal(e.message, "model was not found");
    return true;
  });
});

test("invoke unreachable", async () => {
  const anki = createAnki({ fetchImpl: rejecting });
  await assert.rejects(anki.invoke("version"), (e) => e.kind === "unreachable");
});

test("checkConnection", async () => {
  const ver = (v) =>
    createAnki({ fetchImpl: fakeFetch(() => ({ result: v, error: null })).fetchImpl });
  assert.equal(await ver(6).checkConnection(), "ok");
  assert.equal(await ver(5).checkConnection(), "outdated");
  assert.equal(
    await createAnki({ fetchImpl: rejecting }).checkConnection(),
    "unreachable",
  );
});

test("connect", async () => {
  const denied = fakeFetch((a) => ({
    result: a === "requestPermission" ? { permission: "denied" } : 6,
    error: null,
  }));
  assert.equal(await createAnki({ fetchImpl: denied.fetchImpl }).connect(), "forbidden");

  const granted = fakeFetch((a) => ({
    result: a === "requestPermission" ? { permission: "granted", version: 6 } : 6,
    error: null,
  }));
  assert.equal(await createAnki({ fetchImpl: granted.fetchImpl }).connect(), "ok");
  assert.deepEqual(
    granted.calls.map((c) => c.req.action),
    ["requestPermission", "version"],
  );

  assert.equal(
    await createAnki({ fetchImpl: rejecting }).connect(),
    "unreachable",
  );
});

test("invoke survives a null body and reports non-ok HTTP as an anki error", async () => {
  const nul = createAnki({ fetchImpl: async () => ({ ok: true, json: async () => null }) });
  assert.equal(await nul.invoke("x"), undefined);
  const bad = createAnki({ fetchImpl: async () => ({ ok: false, status: 500, statusText: "Boom", json: async () => ({}) }) });
  await assert.rejects(() => bad.invoke("x"), (e) => e.kind === "anki" && /Boom/.test(e.message));
});

// Only the given URLs answer; the rest fail like a closed port.
function hostsFetch(up) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    const { action } = JSON.parse(opts.body);
    calls.push({ url, action });
    if (!up.includes(url)) throw new TypeError("Failed to fetch");
    return { json: async () => ({ result: action === "requestPermission" ? { permission: "granted" } : 6, error: null }) };
  };
  return { fetchImpl, calls };
}

test("prefers the Mimitori add-on when it answers", async () => {
  const f = hostsFetch([ADDON_URL, ANKICONNECT_URL]);
  const anki = createAnki({ fetchImpl: f.fetchImpl });
  assert.equal(await anki.checkConnection(), "ok");
  await anki.invoke("deckNames");
  assert.deepEqual(f.calls.map((c) => c.url), [ADDON_URL, ADDON_URL]);
});

test("falls back to AnkiConnect and sends later calls there", async () => {
  const f = hostsFetch([ANKICONNECT_URL]);
  const anki = createAnki({ fetchImpl: f.fetchImpl });
  assert.equal(await anki.connect(), "ok");
  f.calls.length = 0;
  await anki.invoke("deckNames");
  assert.deepEqual(f.calls, [{ url: ANKICONNECT_URL, action: "deckNames" }]);
});

test("switches back to the add-on once it appears", async () => {
  const up = [ANKICONNECT_URL];
  const f = hostsFetch(up);
  const anki = createAnki({ fetchImpl: f.fetchImpl });
  await anki.checkConnection();
  up.push(ADDON_URL);
  await anki.checkConnection();
  f.calls.length = 0;
  await anki.invoke("deckNames");
  assert.equal(f.calls[0].url, ADDON_URL);
});
