-- Pawprint application storage for a Supabase-only deployment.
-- Auth/profile identity lives in auth.users and public.profiles. All other
-- application records are owned by the Supabase Edge Function service role;
-- direct browser writes remain disabled by RLS.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists nickname text,
  add column if not exists avatar text,
  add column if not exists age_group text,
  add column if not exists time_zone text not null default 'Asia/Manila',
  add column if not exists language text not null default 'en',
  add column if not exists privacy_notice_version text not null default '2026-10-15',
  add column if not exists privacy_consent_at timestamptz;

create table if not exists public.sightings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text,
  photo_hash text not null,
  cat_type text,
  cat_breed text,
  coat_type text,
  cat_confidence numeric,
  ai_confidence numeric,
  ai_generated boolean not null default false,
  ai_generated_confidence numeric,
  validation_json jsonb not null default '{}'::jsonb,
  validation_status text not null default 'pending' check (validation_status in ('pending','accepted','needs_review','rejected')),
  validation_reason text,
  description text,
  visibility text not null default 'friends' check (visibility in ('public','friends','private')),
  latitude numeric not null,
  longitude numeric not null,
  public_geohash text not null,
  captured_at timestamptz not null,
  uploaded_at timestamptz not null default now(),
  published_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists sightings_photo_hash_idx on public.sightings(photo_hash);
create index if not exists sightings_public_idx on public.sightings(visibility, validation_status, published_at, expires_at);
create index if not exists sightings_user_idx on public.sightings(user_id, captured_at desc);

create table if not exists public.capture_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_time_zone text not null default 'Asia/Manila',
  camera_permission text not null,
  location_permission text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.request_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, request_key)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sighting_id uuid not null unique references public.sightings(id) on delete cascade,
  cat_type text,
  spotted_at timestamptz not null,
  first_spotted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_count integer not null default 0,
  best_count integer not null default 0,
  last_local_day date,
  freeze_count integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sighting_id uuid references public.sightings(id) on delete cascade,
  kind text not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  unique(user_id, sighting_id, kind)
);

create table if not exists public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key(user_id, badge_id)
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_visibility text not null default 'friends',
  show_age_group boolean not null default false,
  allow_friend_requests boolean not null default true,
  notification_preference text not null default 'included',
  updated_at timestamptz not null default now()
);

create table if not exists public.care_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  kind text not null,
  note text,
  status text not null default 'open' check (status in ('open','helped','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  reason text not null,
  note text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, blocked_user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  platform_interest text not null default 'ios_android',
  source text,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  reason text not null,
  status text not null default 'open',
  assigned_to uuid references auth.users(id),
  action text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.rescue_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sighting_id uuid references public.sightings(id) on delete set null,
  need text not null,
  note text,
  public_geohash text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.community_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text not null,
  description text,
  latitude numeric,
  longitude numeric,
  public_geohash text,
  area_name text,
  contact text,
  verified boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.regional_rarity (
  scope_key text not null,
  cat_type text not null,
  sample_count integer not null,
  tier text not null,
  calculated_at timestamptz not null default now(),
  primary key(scope_key, cat_type)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into storage.buckets(id, name, public)
values ('pawprint-sightings', 'pawprint-sightings', false)
on conflict (id) do nothing;

do $$
declare
  item text;
begin
  foreach item in array array[
    'sightings','capture_sessions','request_keys','journal_entries','streaks',
    'reward_ledger','user_badges','user_settings','care_flags','reports','blocks',
    'notifications','waitlist_signups','push_subscriptions','moderation_queue',
    'rescue_requests','community_assets','regional_rarity','audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', item);
  end loop;
end $$;

-- The Edge Function uses the service role, so it is not affected by these
-- policies. They prevent accidental direct browser access through anon keys.
drop policy if exists "edge function owns application tables" on public.sightings;
create policy "edge function owns application tables" on public.sightings for all using (false) with check (false);

create or replace function public.delete_pawprint_user_data(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.blocks where user_id = target_user or blocked_user_id = target_user;
  delete from public.request_keys where user_id = target_user;
  delete from public.capture_sessions where user_id = target_user;
  delete from public.reward_ledger where user_id = target_user;
  delete from public.user_badges where user_id = target_user;
  delete from public.user_settings where user_id = target_user;
  delete from public.care_flags where user_id = target_user;
  delete from public.reports where user_id = target_user;
  delete from public.journal_entries where user_id = target_user;
  delete from public.streaks where user_id = target_user;
  delete from public.notifications where user_id = target_user;
  delete from public.rescue_requests where user_id = target_user;
  delete from public.audit_events where user_id = target_user;
  delete from public.push_subscriptions where user_id = target_user;
  delete from public.sightings where user_id = target_user;
  delete from public.profiles where id = target_user;
end;
$$;

revoke all on function public.delete_pawprint_user_data(uuid) from public, anon, authenticated;
