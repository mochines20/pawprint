CREATE TABLE IF NOT EXISTS waitlist_signups (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  platform_interest TEXT NOT NULL DEFAULT 'ios_android',
  source TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS waitlist_created_idx ON waitlist_signups (created_at DESC);
