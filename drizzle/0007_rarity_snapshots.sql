-- Daily regional rarity snapshots. Current Journal entries retain their
-- classification; this table makes future recalculation explainable.
CREATE TABLE IF NOT EXISTS regional_rarity (
  scope_key TEXT NOT NULL,
  cat_type TEXT NOT NULL,
  sample_count INTEGER NOT NULL,
  tier TEXT NOT NULL,
  calculated_at TEXT NOT NULL,
  PRIMARY KEY (scope_key, cat_type)
);

CREATE INDEX IF NOT EXISTS regional_rarity_type_idx ON regional_rarity (cat_type, tier);
