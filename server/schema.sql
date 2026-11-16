-- Mimitori account server. Ids are 32 hex characters, times are milliseconds.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created INTEGER NOT NULL,
  -- pbkdf2$rounds$salt$hash, set when an emailed code checks out. Added 16 Nov 2026:
  -- ALTER TABLE accounts ADD COLUMN pw_hash TEXT;
  pw_hash TEXT
);
-- A session is a random token the app keeps; only its SHA-256 hash is stored here
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  created INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS email_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  expires INTEGER NOT NULL
);
-- Rate limits: one row per key (e.g. email or address), cleared once reset_at passes
CREATE TABLE IF NOT EXISTS attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
-- The account's words and settings: gzipped JSON in base64, exactly as the app sent it.
-- version goes up by one on every write, so two devices can't overwrite each other.
CREATE TABLE IF NOT EXISTS copies (
  account_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions (account_id);
