-- Profile fields used by the mobile first-login flow.
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN age_group TEXT;
ALTER TABLE users ADD COLUMN location_area TEXT;
ALTER TABLE users ADD COLUMN privacy_notice_version TEXT;
ALTER TABLE users ADD COLUMN privacy_consent_at TEXT;
ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0;

ALTER TABLE user_settings ADD COLUMN cat_spotter_type TEXT NOT NULL DEFAULT 'casual';
ALTER TABLE user_settings ADD COLUMN streak_reminders INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN care_flag_reminders INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN safety_pledge_accepted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN safety_pledge_at TEXT;
ALTER TABLE user_settings ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE user_settings ADD COLUMN guardian_consent_at TEXT;
