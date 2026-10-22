-- The production reports.user_id column is text in older installations.
-- Cast the verified auth UUID explicitly so account deletion can anonymize
-- report evidence without depending on an implicit text/uuid comparison.
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
