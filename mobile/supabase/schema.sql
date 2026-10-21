-- Minimal schema for Pawprint. Run in the Supabase SQL editor, then review the RLS policies.
create type cat_variant as enum ('orange', 'calico', 'black');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null default 'Spotter',
  xp int not null default 0,
  streak int not null default 0,
  last_spot_day date,
  visibility text not null default 'friends' check (visibility in ('everyone','friends','only_me'))
);

create table public.sightings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  variant cat_variant not null,
  photo_path text not null,                 -- private bucket 'sightings', served by signed URL only
  exact_point geography(point) not null,    -- never exposed to clients
  show_pin boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table public.care_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  need text not null,
  note text,
  exact_point geography(point) not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.profiles   enable row level security;
alter table public.sightings  enable row level security;
alter table public.care_flags enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own sightings" on public.sightings for select using (user_id = auth.uid());
create policy "own flags" on public.care_flags for select using (user_id = auth.uid());
-- Inserts go through SECURITY DEFINER RPCs (create_sighting, create_care_flag) that round coordinates.

-- Public pins: ~150 m grid, 5 minute delay, only unexpired, only if the owner chose to show it.
create view public.sightings_public with (security_invoker = false) as
select id, variant,
       round(st_y(exact_point::geometry)::numeric, 3) as approx_lat,
       round(st_x(exact_point::geometry)::numeric, 3) as approx_lng,
       (user_id = auth.uid()) as mine
from public.sightings
where show_pin and expires_at > now() and created_at < now() - interval '5 minutes';

-- Schedule expiry cleanup, e.g. with pg_cron: delete from sightings where expires_at < now() - interval '7 days';
