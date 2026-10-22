-- Production had empty legacy record tables with text IDs and a smaller
-- sightings shape. Align them with the mobile API before the first real write.
-- The preflight check for the live project confirmed these tables are empty.

begin;

alter table public.journal_entries drop constraint if exists journal_entries_sighting_id_fkey;
alter table public.reward_ledger drop constraint if exists reward_ledger_sighting_id_fkey;
alter table public.care_flags drop constraint if exists care_flags_sighting_id_fkey;
alter table public.sighting_seen drop constraint if exists sighting_seen_sighting_id_fkey;

alter table public.sightings rename column photo_key to storage_path;
alter table public.sightings alter column id type uuid using id::uuid;
alter table public.sightings alter column captured_at type timestamptz using nullif(captured_at, '')::timestamptz;
alter table public.sightings alter column uploaded_at type timestamptz using nullif(uploaded_at, '')::timestamptz;
alter table public.sightings alter column published_at type timestamptz using nullif(published_at, '')::timestamptz;
alter table public.sightings alter column expires_at type timestamptz using nullif(expires_at, '')::timestamptz;
alter table public.sightings alter column created_at type timestamptz using nullif(created_at, '')::timestamptz;
alter table public.sightings alter column uploaded_at set default now();
alter table public.sightings alter column created_at set default now();
alter table public.sightings alter column photo_hash set not null;

alter table public.sightings
  add column if not exists cat_breed text,
  add column if not exists coat_type text,
  add column if not exists cat_confidence numeric,
  add column if not exists ai_confidence numeric,
  add column if not exists ai_generated boolean not null default false,
  add column if not exists ai_generated_confidence numeric,
  add column if not exists validation_json jsonb not null default '{}'::jsonb;

create unique index if not exists sightings_photo_hash_idx on public.sightings(photo_hash);

alter table public.capture_sessions alter column expires_at type timestamptz using nullif(expires_at, '')::timestamptz;
alter table public.capture_sessions alter column used_at type timestamptz using nullif(used_at, '')::timestamptz;
alter table public.capture_sessions alter column created_at type timestamptz using nullif(created_at, '')::timestamptz;
alter table public.capture_sessions alter column expires_at set default now() + interval '10 minutes';
alter table public.capture_sessions alter column created_at set default now();

alter table public.request_keys alter column response_json type jsonb using nullif(response_json, '')::jsonb;
alter table public.request_keys alter column created_at type timestamptz using nullif(created_at, '')::timestamptz;
alter table public.request_keys alter column response_json set default '{}'::jsonb;
alter table public.request_keys alter column response_json set not null;
alter table public.request_keys alter column created_at set default now();

alter table public.journal_entries alter column id type uuid using id::uuid;
alter table public.journal_entries alter column sighting_id type uuid using sighting_id::uuid;
alter table public.journal_entries alter column spotted_at type timestamptz using nullif(spotted_at, '')::timestamptz;
alter table public.journal_entries alter column created_at type timestamptz using nullif(created_at, '')::timestamptz;
alter table public.journal_entries alter column first_spotted drop default;
alter table public.journal_entries alter column first_spotted type boolean using first_spotted <> 0;
alter table public.journal_entries alter column first_spotted set default false;
alter table public.journal_entries alter column created_at set default now();

alter table public.streaks alter column last_local_day type date using nullif(last_local_day, '')::date;
alter table public.streaks alter column updated_at type timestamptz using nullif(updated_at, '')::timestamptz;
alter table public.streaks alter column updated_at set default now();

alter table public.reward_ledger alter column id type uuid using id::uuid;
alter table public.reward_ledger alter column sighting_id type uuid using sighting_id::uuid;
alter table public.reward_ledger alter column created_at type timestamptz using nullif(created_at, '')::timestamptz;
alter table public.reward_ledger alter column created_at set default now();

alter table public.user_badges alter column earned_at type timestamptz using nullif(earned_at, '')::timestamptz;
alter table public.user_badges alter column earned_at set default now();

alter table public.user_settings alter column show_age_group drop default;
alter table public.user_settings alter column allow_friend_requests drop default;
alter table public.user_settings alter column show_age_group type boolean using show_age_group <> 0;
alter table public.user_settings alter column allow_friend_requests type boolean using allow_friend_requests <> 0;
alter table public.user_settings alter column updated_at type timestamptz using nullif(updated_at, '')::timestamptz;
alter table public.user_settings alter column updated_at set default now();

alter table public.care_flags alter column id type uuid using id::uuid;
alter table public.care_flags alter column sighting_id type uuid using sighting_id::uuid;
alter table public.care_flags alter column created_at type timestamptz using nullif(created_at, '')::timestamptz;
alter table public.care_flags alter column created_at set default now();

alter table public.notifications alter column id type uuid using id::uuid;
alter table public.notifications alter column created_at type timestamptz using nullif(created_at, '')::timestamptz;
alter table public.notifications alter column created_at set default now();

alter table public.sighting_seen alter column sighting_id type uuid using sighting_id::uuid;
alter table public.sighting_seen
  add constraint sighting_seen_sighting_id_fkey foreign key (sighting_id) references public.sightings(id) on delete cascade;

alter table public.journal_entries
  add constraint journal_entries_sighting_id_fkey foreign key (sighting_id) references public.sightings(id) on delete cascade;
alter table public.reward_ledger
  add constraint reward_ledger_sighting_id_fkey foreign key (sighting_id) references public.sightings(id) on delete cascade;
alter table public.care_flags
  add constraint care_flags_sighting_id_fkey foreign key (sighting_id) references public.sightings(id) on delete cascade;

commit;
