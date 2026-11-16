// Test helper: an in-memory SQLite shaped like D1, plus fake mail, clock and randomness.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

export function testDeps() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(schema);
  const stmt = (query, args = []) => ({
    bind: (...a) => stmt(query, a),
    first: async () => sql.prepare(query).get(...args) ?? null,
    run: async () => ({ meta: { changes: Number(sql.prepare(query).run(...args).changes) } }),
  });
  let t = 1_800_000_000_000;
  const sent = [];
  return {
    db: {
      prepare: (q) => stmt(q),
      async batch(list) {
        sql.exec("BEGIN");
        for (const s of list) await s.run();
        sql.exec("COMMIT");
      },
    },
    sent,
    tick: (ms) => { t += ms; },
    now: () => t,
    mail: async (to, subject, text, code) => { sent.push({ to, text, code }); },
    random: (n) => new Uint8Array(randomBytes(n)),
  };
}

