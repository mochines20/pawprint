-- Store the server-side image validation decision and classification evidence.
-- A non-accepted result never earns rewards or becomes a public map record.
ALTER TABLE sightings ADD COLUMN cat_breed TEXT;
ALTER TABLE sightings ADD COLUMN coat_type TEXT;
ALTER TABLE sightings ADD COLUMN cat_confidence REAL;
ALTER TABLE sightings ADD COLUMN ai_confidence REAL;
ALTER TABLE sightings ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sightings ADD COLUMN ai_generated_confidence REAL;
ALTER TABLE sightings ADD COLUMN validation_json TEXT;
