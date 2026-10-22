-- Security fix: profiles must not be publicly readable.
-- Leaderboards use the service-role Edge Function and return only the
-- intentionally public nickname/avatar projection.
drop policy if exists "profiles are publicly readable" on public.profiles;

alter table public.profiles enable row level security;

drop policy if exists "own profile only" on public.profiles;
create policy "own profile only" on public.profiles
  for select using (id = auth.uid());
