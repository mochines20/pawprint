-- Complete the durable schema used by the Worker. These columns are additive so
-- an existing D1 installation can be upgraded without replacing user data.
ALTER TABLE users ADD COLUMN age_group TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;

ALTER TABLE sightings ADD COLUMN cat_breed TEXT;
ALTER TABLE sightings ADD COLUMN coat_type TEXT;
ALTER TABLE sightings ADD COLUMN cat_confidence REAL;
ALTER TABLE sightings ADD COLUMN ai_confidence REAL;
ALTER TABLE sightings ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sightings ADD COLUMN ai_generated_confidence REAL;
ALTER TABLE sightings ADD COLUMN validation_json TEXT;
ALTER TABLE sightings ADD COLUMN description TEXT;
ALTER TABLE sightings ADD COLUMN city_name TEXT;
ALTER TABLE sightings ADD COLUMN barangay_name TEXT;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id, updated_at DESC);
