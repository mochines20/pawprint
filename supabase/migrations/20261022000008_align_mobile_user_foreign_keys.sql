-- The production project was created from an older schema where application
-- user IDs were text values referencing public.users. The mobile API uses
-- Supabase Auth UUIDs, so align the empty legacy tables with auth.users before
-- accepting authenticated mobile writes.

begin;

alter table public.sightings drop constraint if exists sightings_user_id_fkey;
alter table public.journal_entries drop constraint if exists journal_entries_user_id_fkey;
alter table public.streaks drop constraint if exists streaks_user_id_fkey;
alter table public.care_flags drop constraint if exists care_flags_user_id_fkey;
alter table public.blocks drop constraint if exists blocks_user_id_fkey;
alter table public.blocks drop constraint if exists blocks_blocked_user_id_fkey;
alter table public.capture_sessions drop constraint if exists capture_sessions_user_id_fkey;
alter table public.reward_ledger drop constraint if exists reward_ledger_user_id_fkey;
alter table public.user_settings drop constraint if exists user_settings_user_id_fkey;
alter table public.request_keys drop constraint if exists request_keys_user_id_fkey;
alter table public.notifications drop constraint if exists notifications_user_id_fkey;
alter table public.user_badges drop constraint if exists user_badges_user_id_fkey;
alter table public.quest_progress drop constraint if exists quest_progress_user_id_fkey;

alter table public.sightings alter column user_id type uuid using user_id::uuid;
alter table public.journal_entries alter column user_id type uuid using user_id::uuid;
alter table public.streaks alter column user_id type uuid using user_id::uuid;
alter table public.care_flags alter column user_id type uuid using user_id::uuid;
alter table public.blocks alter column user_id type uuid using user_id::uuid;
alter table public.blocks alter column blocked_user_id type uuid using blocked_user_id::uuid;
alter table public.capture_sessions alter column user_id type uuid using user_id::uuid;
alter table public.reward_ledger alter column user_id type uuid using user_id::uuid;
alter table public.user_settings alter column user_id type uuid using user_id::uuid;
alter table public.request_keys alter column user_id type uuid using user_id::uuid;
alter table public.notifications alter column user_id type uuid using user_id::uuid;
alter table public.user_badges alter column user_id type uuid using user_id::uuid;
alter table public.quest_progress alter column user_id type uuid using user_id::uuid;

alter table public.capture_sessions alter column id set default (gen_random_uuid()::text);
alter table public.capture_sessions alter column created_at set default now();

alter table public.sightings add constraint sightings_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.journal_entries add constraint journal_entries_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.streaks add constraint streaks_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.care_flags add constraint care_flags_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.blocks add constraint blocks_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.blocks add constraint blocks_blocked_user_id_fkey foreign key (blocked_user_id) references auth.users(id) on delete cascade;
alter table public.capture_sessions add constraint capture_sessions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.reward_ledger add constraint reward_ledger_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.user_settings add constraint user_settings_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.request_keys add constraint request_keys_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.notifications add constraint notifications_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.user_badges add constraint user_badges_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.quest_progress add constraint quest_progress_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;

commit;
