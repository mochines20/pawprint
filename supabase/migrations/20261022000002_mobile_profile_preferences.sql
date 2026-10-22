alter table public.profiles
  add column if not exists cat_spotter_type text not null default 'casual',
  add column if not exists streak_reminders boolean not null default false,
  add column if not exists care_flag_reminders boolean not null default false,
  add column if not exists safety_pledge_accepted boolean not null default false,
  add column if not exists safety_pledge_at timestamptz,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists guardian_consent_at timestamptz;

alter table public.user_settings
  add column if not exists cat_spotter_type text not null default 'casual',
  add column if not exists streak_reminders boolean not null default false,
  add column if not exists care_flag_reminders boolean not null default false;
