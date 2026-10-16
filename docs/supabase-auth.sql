-- Pawprint profile data is separate from auth.users.
-- Run this in Supabase SQL Editor before enabling onboarding.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  avatar text,
  age_group text not null check (age_group in ('13_17', '18_24', '25_34', '35_44', '45_plus', 'prefer_not_to_say')),
  privacy_notice_version text not null default '2026-10-15',
  privacy_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe migration for profiles created by an earlier version of Pawprint.
alter table public.profiles
  add column if not exists privacy_notice_version text not null default '2026-10-15';
alter table public.profiles
  add column if not exists privacy_consent_at timestamptz;

alter table public.profiles enable row level security;

drop policy if exists "profiles are publicly readable" on public.profiles;
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

drop policy if exists "users can create their own profile" on public.profiles;
create policy "users can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "users can delete their own profile" on public.profiles;
create policy "users can delete their own profile"
  on public.profiles for delete
  using (auth.uid() = id);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();
