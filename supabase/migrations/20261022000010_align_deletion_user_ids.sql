-- Keep account deletion type-safe across the remaining legacy tables.

begin;

alter table public.rescue_requests drop constraint if exists rescue_requests_user_id_fkey;
alter table public.reports alter column user_id type uuid using nullif(user_id, '')::uuid;
alter table public.rescue_requests alter column user_id type uuid using user_id::uuid;
alter table public.audit_events alter column user_id type uuid using nullif(user_id, '')::uuid;

alter table public.rescue_requests
  add constraint rescue_requests_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

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
  update public.reports set user_id = null where user_id = target_user;
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

commit;
