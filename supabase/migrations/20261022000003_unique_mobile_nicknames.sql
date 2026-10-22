-- Nicknames are public-facing identities. Enforce uniqueness in the database
-- so two simultaneous profile saves cannot claim the same nickname.
-- The partial predicate allows pre-onboarding placeholder profiles to share
-- the default value until the user completes profile setup.
create unique index if not exists profiles_onboarded_nickname_lower_idx
  on public.profiles (lower(nickname))
  where onboarding_completed = true
    and nickname is not null
    and length(trim(nickname)) > 0;
