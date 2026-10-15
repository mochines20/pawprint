# Pawprint Supabase Auth setup

Pawprint does not implement passwords, sessions, or social OAuth itself. The browser uses Supabase Auth with PKCE and the Worker verifies the Supabase access token through Supabase's `/auth/v1/user` endpoint.

## Site environment variables

Add these as Site environment variables. The anon key is public and may be sent to the browser; never add a Supabase service-role key to the frontend or this repository.

- `SUPABASE_URL`: the project URL, for example `https://your-project.supabase.co`
- `SUPABASE_ANON_KEY`: the project's publishable/anon key

The `/api/auth/config` endpoint exposes only these two public values. Until they are configured, the sign-in UI stays disabled and no fallback password system is used.

## Providers and redirects

In Supabase Authentication settings, configure Magic Link, Google, and Apple as needed. Add only real app domains to the Supabase URL Configuration allow-list:

- `https://pawprint.madison88-0851.chatgpt.site/auth/callback`
- `http://localhost:4173/auth/callback` for local testing only

For Google and Apple, register Supabase's provider callback URL in the provider console, then paste the provider credentials into Supabase. The app redirects users back to `/auth/callback`, exchanges the PKCE code, and sends first-time users to onboarding.

## Profile privacy

Run [`supabase-auth.sql`](./supabase-auth.sql) in the Supabase SQL Editor. The table stores only the user's chosen nickname, avatar URL, and age group. It does not copy the provider's real name, provider avatar, or email. Row Level Security allows public profile reads and limits writes to the matching `auth.uid()`.

## Test checklist

1. Configure `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
2. Run the profile migration.
3. Add the local and production callback URLs.
4. Open the app, choose Sign in, and request a magic link.
5. Open the link, complete onboarding, refresh, and confirm the session remains.
6. Sign out and confirm protected API actions ask for sign-in.
7. Enable Google/Apple one at a time and verify each callback on the real domain.
