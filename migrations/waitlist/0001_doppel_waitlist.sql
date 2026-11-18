-- Only access-update requests, not accounts, invitations or product entitlements.
CREATE TABLE IF NOT EXISTS doppel_waitlist (
  email TEXT PRIMARY KEY NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'zh')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
