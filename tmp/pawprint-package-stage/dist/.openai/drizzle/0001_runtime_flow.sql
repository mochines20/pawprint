-- Runtime flow tables for capture proof, idempotent requests, privacy settings, and rewards.
-- The Worker also creates these tables defensively for existing installations.

CREATE TABLE IF NOT EXISTS capture_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  device_time_zone TEXT NOT NULL DEFAULT 'Asia/Manila',
  camera_permission TEXT NOT NULL,
  location_permission TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  sighting_id TEXT NOT NULL REFERENCES sightings(id),
  kind TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, sighting_id, kind)
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  default_visibility TEXT NOT NULL DEFAULT 'friends',
  show_age_group INTEGER NOT NULL DEFAULT 0,
  allow_friend_requests INTEGER NOT NULL DEFAULT 1,
  notification_preference TEXT NOT NULL DEFAULT 'included',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS request_keys (
  user_id TEXT NOT NULL REFERENCES users(id),
  request_key TEXT NOT NULL,
  response_json TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, request_key)
);

CREATE INDEX IF NOT EXISTS capture_sessions_user_idx ON capture_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reward_ledger_user_idx ON reward_ledger (user_id, created_at DESC);
