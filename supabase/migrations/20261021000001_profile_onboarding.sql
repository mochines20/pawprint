-- First-login profile setup fields. Keep location coarse and optional by design.
alter table public.profiles
  add column if not exists gender text,
  add column if not exists location_area text,
  add column if not exists onboarding_completed boolean not null default false;
