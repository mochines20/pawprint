-- Existing production databases may have capture_sessions.id without the
-- default from the original table definition. Keep the schema safe for
-- direct inserts; the Edge Function also supplies an explicit UUID.
alter table public.capture_sessions
  alter column id set default (gen_random_uuid()::text);

alter table public.capture_sessions
  alter column created_at set default now();
