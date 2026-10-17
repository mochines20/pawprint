# Pawprint Supabase-only deployment

Pawprint uses Supabase Auth, Postgres, Storage, and Edge Functions. No D1,
R2, Worker bindings, or Wrangler configuration is required for the backend.

## 1. Apply the schema

Run `supabase/migrations/20261017000000_pawprint_app.sql` in the Supabase SQL
Editor, or use the Supabase CLI migrations workflow. It creates the application
tables, RLS boundaries, and the private `pawprint-sightings` Storage bucket.

Run `docs/supabase-auth.sql` as well if the `profiles` table has not been
created yet.

## 2. Deploy the API function

Deploy `supabase/functions/pawprint-api/index.ts` as `pawprint-api` using the
Supabase CLI or the Supabase dashboard. Configure these Edge Function secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` or `OLLAMA_BASE_URL` and `OLLAMA_MODEL`
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, and `BREVO_SENDER_NAME`
- `ADMIN_USER_IDS`
- `PUSH_PUBLIC_KEY`, `PUSH_PRIVATE_KEY`, and `PUSH_SUBJECT`
- `MAINTENANCE_TOKEN`

Never put `SUPABASE_SERVICE_ROLE_KEY`, AI keys, Brevo keys, admin IDs, or the
push private key in browser code.

## 3. Connect localhost

Copy `.env.example` to `.env.local`, configure the public Supabase URL and anon
key, then set:

```text
PAWPRINT_SUPABASE_FUNCTION_URL=https://<project-ref>.supabase.co/functions/v1/pawprint-api
```

Start the preview with `npm start`. `/api/health` should report
`persistence: "supabase-edge-function"`.

## 4. Auth redirects

Add the local and production `/auth/callback` URLs in Supabase Authentication
settings. Enable Google or Apple only after their provider credentials are
configured.

## 5. Scheduled maintenance

Use Supabase Cron or an external scheduler to call the `pawprint-maintenance`
Edge Function with `Authorization: Bearer <MAINTENANCE_TOKEN>` for expired
sightings and rarity snapshots. The browser does not perform privileged cleanup.

## 6. QA

Run the local build and browser checks first. Then run the authenticated matrix
against the deployed function using two normal users and one admin: privacy
isolation, duplicate/idempotency, AI rejection, offline retry, account deletion,
care resolution, blocking, and Philippines timezone streak boundaries.
