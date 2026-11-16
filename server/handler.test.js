import { test } from "node:test";
import assert from "node:assert/strict";
import { testDeps } from "./testDeps.js";
import { handle, mailbox, MAX_COPY } from "./handler.js";

const call = (deps, method, path, { body, token, headers = {} } = {}) =>
  handle(new Request("https://api.test" + path, {
    method,
    headers: { ...(token && { Authorization: `Bearer ${token}` }), ...headers },
    body: typeof body === "string" ? body : body && JSON.stringify(body),
  }), deps);

const PW = "correct horse";

async function signIn(deps, email = "dan@example.com") {
  await call(deps, "POST", "/auth/start", { body: { email } });
  const code = deps.sent.at(-1).code;
  const r = await call(deps, "POST", "/auth/verify", { body: { email, code, password: PW } });
  return (await r.json()).session;
}

test("signing in with the mailed code gives a session", async () => {
  const deps = testDeps();
  const token = await signIn(deps);
  assert.match(deps.sent[0].text, /\d{6}/);
  assert.equal(token.length, 64);
  const me = await call(deps, "GET", "/me", { token });
  assert.deepEqual(await me.json(), { email: "dan@example.com" });
});

test("a code works once", async () => {
  const deps = testDeps();
  await call(deps, "POST", "/auth/start", { body: { email: "a@b.co" } });
  const code = deps.sent[0].code;
  assert.equal((await call(deps, "POST", "/auth/verify", { body: { email: "a@b.co", code, password: PW } })).status, 200);
  assert.equal((await call(deps, "POST", "/auth/verify", { body: { email: "a@b.co", code, password: PW } })).status, 400);
});

test("five wrong tries cancel the code", async () => {
  const deps = testDeps();
  await call(deps, "POST", "/auth/start", { body: { email: "a@b.co" } });
  const code = deps.sent[0].code;
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await call(deps, "POST", "/auth/verify", { body: { email: "a@b.co", code: wrong, password: PW } });
  assert.equal((await call(deps, "POST", "/auth/verify", { body: { email: "a@b.co", code, password: PW } })).status, 400);
});

test("a code runs out after 10 minutes", async () => {
  const deps = testDeps();
  await call(deps, "POST", "/auth/start", { body: { email: "a@b.co" } });
  deps.tick(10 * 60_000 + 1);
  assert.equal((await call(deps, "POST", "/auth/verify", { body: { email: "a@b.co", code: deps.sent[0].code, password: PW } })).status, 400);
});

test("one mailbox gets at most 5 codes an hour, counting + and dot variants", async () => {
  const deps = testDeps();
  for (const e of ["d.an@gmail.com", "dan+1@gmail.com", "dan@gmail.com", "DAN@gmail.com", "dan+x@googlemail.com", "dan@gmail.com"]) {
    assert.equal((await call(deps, "POST", "/auth/start", { body: { email: e } })).status, 200);
  }
  assert.equal(deps.sent.length, 5);
  assert.equal(mailbox("d.a.n+zz@googlemail.com"), "dan@gmail.com");
});

test("a bad address is refused", async () => {
  const deps = testDeps();
  for (const email of ["", "nope", "a b@c.d", "a@b.c, x@y.z", 7]) {
    assert.equal((await call(deps, "POST", "/auth/start", { body: { email } })).status, 400);
  }
});

test("the code sets the password, then email and password sign in", async () => {
  const deps = testDeps();
  await signIn(deps);
  const login = (password, email = "dan@example.com") => call(deps, "POST", "/auth/login", { body: { email, password } });
  const r = await login(PW);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).session.length, 64);
  assert.equal((await login("wrong one")).status, 400);
  assert.equal((await login(PW, "nobody@example.com")).status, 400);
});

test("a short password is refused and the code stays usable", async () => {
  const deps = testDeps();
  await call(deps, "POST", "/auth/start", { body: { email: "a@b.co" } });
  const code = deps.sent[0].code;
  assert.equal((await call(deps, "POST", "/auth/verify", { body: { email: "a@b.co", code, password: "short" } })).status, 400);
  assert.equal((await call(deps, "POST", "/auth/verify", { body: { email: "a@b.co", code, password: PW } })).status, 200);
});

test("a new code resets the password", async () => {
  const deps = testDeps();
  await signIn(deps);
  await call(deps, "POST", "/auth/start", { body: { email: "dan@example.com" } });
  await call(deps, "POST", "/auth/verify", { body: { email: "dan@example.com", code: deps.sent.at(-1).code, password: "new password" } });
  const login = (password) => call(deps, "POST", "/auth/login", { body: { email: "dan@example.com", password } });
  assert.equal((await login(PW)).status, 400);
  assert.equal((await login("new password")).status, 200);
});

test("password guesses stop after 10 an hour", async () => {
  const deps = testDeps();
  await signIn(deps);
  for (let i = 0; i < 10; i++) await call(deps, "POST", "/auth/login", { body: { email: "dan@example.com", password: "guess " + i } });
  assert.equal((await call(deps, "POST", "/auth/login", { body: { email: "dan@example.com", password: PW } })).status, 429);
});

test("no session, no copy", async () => {
  const deps = testDeps();
  assert.equal((await call(deps, "GET", "/copy")).status, 401);
  assert.equal((await call(deps, "GET", "/copy", { token: "f".repeat(64) })).status, 401);
});

test("the copy saves on top of the version last read, and refuses a stale write", async () => {
  const deps = testDeps();
  const token = await signIn(deps);
  const empty = await call(deps, "GET", "/copy", { token });
  assert.equal(empty.headers.get("X-Version"), "0");
  assert.equal(await empty.text(), "");

  const put = (body, v) => call(deps, "PUT", "/copy", { token, body, headers: { "If-Match": String(v) } });
  assert.deepEqual(await (await put("one", 0)).json(), { version: 1 });
  assert.equal((await put("other phone", 0)).status, 409);
  assert.deepEqual(await (await put("two", 1)).json(), { version: 2 });
  assert.equal((await put("stale", 1)).status, 409);

  const got = await call(deps, "GET", "/copy", { token });
  assert.equal(await got.text(), "two");
  assert.equal(got.headers.get("X-Version"), "2");
});

test("a second device signs in to the same account and sees the copy", async () => {
  const deps = testDeps();
  const phone = await signIn(deps);
  await call(deps, "PUT", "/copy", { token: phone, body: "words", headers: { "If-Match": "0" } });
  const laptop = await signIn(deps);
  assert.notEqual(phone, laptop);
  assert.equal(await (await call(deps, "GET", "/copy", { token: laptop })).text(), "words");
});

test("accounts can't see each other's copy", async () => {
  const deps = testDeps();
  const a = await signIn(deps, "a@b.co");
  await call(deps, "PUT", "/copy", { token: a, body: "secret", headers: { "If-Match": "0" } });
  const b = await signIn(deps, "c@d.co");
  assert.equal(await (await call(deps, "GET", "/copy", { token: b })).text(), "");
});

test("a copy too big for the database is refused", async () => {
  const deps = testDeps();
  const token = await signIn(deps);
  const r = await call(deps, "PUT", "/copy", { token, body: "x".repeat(MAX_COPY + 1), headers: { "If-Match": "0" } });
  assert.equal(r.status, 413);
});

test("signing out ends that session only", async () => {
  const deps = testDeps();
  const a = await signIn(deps), b = await signIn(deps);
  await call(deps, "POST", "/signout", { token: a });
  assert.equal((await call(deps, "GET", "/me", { token: a })).status, 401);
  assert.equal((await call(deps, "GET", "/me", { token: b })).status, 200);
});

test("deleting the account removes the copy and every session", async () => {
  const deps = testDeps();
  const a = await signIn(deps), b = await signIn(deps);
  await call(deps, "PUT", "/copy", { token: a, body: "words", headers: { "If-Match": "0" } });
  assert.equal((await call(deps, "DELETE", "/account", { token: a })).status, 200);
  assert.equal((await call(deps, "GET", "/me", { token: b })).status, 401);
  const again = await signIn(deps);
  assert.equal(await (await call(deps, "GET", "/copy", { token: again })).text(), "");
});

test("a session unused for 180 days runs out", async () => {
  const deps = testDeps();
  const token = await signIn(deps);
  deps.tick(181 * 86400_000);
  assert.equal((await call(deps, "GET", "/me", { token })).status, 401);
});

test("replies carry CORS headers, errors included", async () => {
  const deps = testDeps();
  assert.equal((await call(deps, "OPTIONS", "/copy")).headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal((await call(deps, "GET", "/nope")).status, 404);
  const broken = { ...deps, db: { prepare: () => { throw new Error("db down"); } } };
  const r = await call(broken, "POST", "/auth/start", { body: { email: "a@b.co" } });
  assert.equal(r.status, 500);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "*");
});
