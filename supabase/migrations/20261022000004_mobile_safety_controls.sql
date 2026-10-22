-- P0 safety controls for mobile launch.
alter table public.sightings
  add column if not exists capture_source text not null default 'camera',
  add column if not exists photo_dhash text;

alter table public.sightings
  alter column latitude drop not null,
  alter column longitude drop not null,
  alter column public_geohash drop not null;

do $$
begin
  alter table public.sightings
    add constraint sightings_capture_source_check
    check (capture_source in ('camera', 'gallery'));
exception when duplicate_object then null;
end $$;

create table if not exists public.sighting_seen (
  user_id uuid not null references auth.users(id) on delete cascade,
  sighting_id text not null references public.sightings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, sighting_id)
);

alter table public.sighting_seen enable row level security;
drop policy if exists "edge function owns sighting seen" on public.sighting_seen;
create policy "edge function owns sighting seen" on public.sighting_seen
  for all using (false) with check (false);

-- Direct client reads are denied for application data. The Edge Function uses
-- the service role and applies the user/block checks itself.
alter table public.profiles enable row level security;
drop policy if exists "own profile only" on public.profiles;
create policy "own profile only" on public.profiles
  for select using (id = auth.uid());

alter table public.journal_entries enable row level security;
alter table public.reports enable row level security;
alter table public.care_flags enable row level security;
alter table public.blocks enable row level security;

-- Reports remain as moderation evidence after account deletion, but the
-- reporter identity is anonymized instead of being cascaded away.
alter table public.reports alter column user_id drop not null;
alter table public.reports drop constraint if exists reports_user_id_fkey;
-- The legacy reports.user_id is text. Keep it nullable so moderation evidence
-- survives account deletion without introducing a mismatched UUID foreign key.

-- Legacy "friends" has no implemented friends graph. Existing rows default
-- to private until the user explicitly chooses Everyone.
update public.user_settings
set default_visibility = 'private'
where default_visibility = 'friends';
alter table public.user_settings
  alter column default_visibility set default 'private';

create table if not exists public.sighting_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id, request_key)
);

alter table public.sighting_attempts enable row level security;
drop policy if exists "edge function owns sighting attempts" on public.sighting_attempts;
create policy "edge function owns sighting attempts" on public.sighting_attempts
  for all using (false) with check (false);

create index if not exists sighting_attempts_user_created_idx
  on public.sighting_attempts(user_id, created_at desc);

create or replace function public.reserve_sighting_attempt(target_user uuid, target_request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hour_count integer;
  day_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_user::text, 0));

  if exists (
    select 1 from public.sighting_attempts
    where user_id = target_user and request_key = target_request_key
  ) then
    return jsonb_build_object('allowed', true, 'replayed', true);
  end if;

  select count(*)::integer into hour_count
  from public.sighting_attempts
  where user_id = target_user and created_at >= now() - interval '1 hour';
  if hour_count >= 5 then
    return jsonb_build_object('allowed', false, 'reason', 'hourly_limit');
  end if;

  select count(*)::integer into day_count
  from public.sighting_attempts
  where user_id = target_user and created_at >= now() - interval '24 hours';
  if day_count >= 20 then
    return jsonb_build_object('allowed', false, 'reason', 'daily_limit');
  end if;

  insert into public.sighting_attempts(user_id, request_key)
  values (target_user, target_request_key);
  return jsonb_build_object('allowed', true, 'replayed', false);
end;
$$;

revoke all on function public.reserve_sighting_attempt(uuid, text) from public, anon, authenticated;

create index if not exists sightings_user_uploaded_idx
  on public.sightings(user_id, uploaded_at desc);

create index if not exists sightings_user_dhash_idx
  on public.sightings(user_id, photo_dhash, uploaded_at desc)
  where photo_dhash is not null;

create index if not exists reports_target_idx
  on public.reports(target_type, target_id, created_at desc);

create or replace function public.mark_sighting_seen(target_user uuid, target_sighting text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sighting_seen(user_id, sighting_id)
  values (target_user, target_sighting)
  on conflict (user_id, sighting_id) do nothing;
  return found;
end;
$$;

revoke all on function public.mark_sighting_seen(uuid, text) from public, anon, authenticated;

create or replace function public.delete_pawprint_user_data(target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.blocks where user_id = target_user or blocked_user_id = target_user;
  delete from public.sighting_seen where user_id = target_user;
  delete from public.sighting_attempts where user_id = target_user;
  delete from public.request_keys where user_id = target_user;
  delete from public.capture_sessions where user_id = target_user;
  delete from public.reward_ledger where user_id = target_user;
  delete from public.user_badges where user_id = target_user;
  delete from public.user_settings where user_id = target_user;
  delete from public.care_flags where user_id = target_user;
  update public.reports set user_id = null where user_id = target_user::text;
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
