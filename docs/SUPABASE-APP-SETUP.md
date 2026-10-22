# Pawprint Supabase-only deployment

Pawprint uses Supabase Auth, Postgres, Storage, and Edge Functions. No D1,
R2, Worker bindings, or Wrangler configuration is required for the backend.

## 1. Apply the schema

Run `supabase/migrations/20261017000000_pawprint_app.sql` in the Supabase SQL
Editor, or use the Supabase CLI migrations workflow. It creates the application
tables, RLS boundaries, and the private `pawprint-sightings` Storage bucket.

For the mobile launch, apply the profile/onboarding migrations in order:
`20261022000002_mobile_profile_preferences.sql`,
`20261022000003_unique_mobile_nicknames.sql`,
`20261022000004_mobile_safety_controls.sql`,
`20261022000005_fix_profile_rls.sql`, and
`20261022000006_fix_report_anonymization.sql`. The last migration keeps
moderation evidence while safely anonymizing legacy `reports.user_id` text
values during account deletion.

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
- Optional `PAWPRINT_PUBLIC_URL` (production: `https://pawprint-omega.vercel.app`)
- `ADMIN_USER_IDS`
- `PUSH_PUBLIC_KEY`, `PUSH_PRIVATE_KEY`, and `PUSH_SUBJECT`
- `MAINTENANCE_TOKEN`

Never put `SUPABASE_SERVICE_ROLE_KEY`, AI keys, Brevo keys, admin IDs, or the
push private key in browser code.

The waitlist confirmation email is already on-brand in the Edge Function. The
function sends Pawprint's built-in responsive HTML directly through Brevo's
transactional API, with the amber CTA, outlined card, actual Pawprint logo,
privacy note, and mobile-safe layout. A Brevo template ID is not required.
Set `PAWPRINT_PUBLIC_URL=https://pawprint-omega.vercel.app` in the production
Edge Function secrets to enable the email CTA
and logo. Keep it blank in local preview so the email does not link to
localhost.

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

## 5. Web Push notifications

The browser subscribes through the service worker and stores the subscription in
`push_subscriptions`. The API sends encrypted Web Push messages when a user
receives an app notification. VAPID keys stay in Edge Function secrets; only
the public key is returned by `/api/push/config`.

The production project has a VAPID key pair configured and the push sender uses
the edge-native `@mmmike/web-push` implementation. Users still need to tap
`Enable reminders` and grant browser notification permission. On iOS, the PWA
must be installed to the Home Screen before Web Push is available.

## 6. Scheduled maintenance

The production project has an active Supabase Cron job named
`pawprint-maintenance-every-15-minutes` (`*/15 * * * *`). It calls the
`pawprint-maintenance` Edge Function with its bearer token read from Supabase
Vault. The function expires old sightings and recalculates 30-day regional
rarity snapshots. The browser does not perform privileged cleanup.

## 7. QA

Run the local build and browser checks first. Then run the authenticated matrix
against the deployed function using two normal users and one admin: privacy
isolation, duplicate/idempotency, AI rejection, offline retry, account deletion,
care resolution, blocking, and Philippines timezone streak boundaries.

The deterministic checks are `npm run qa:edge`, `npm run qa:dhash`,
`npm run qa:mobile`, and `npm run build`. The public Privacy, Terms, Support,
and account-deletion URLs must return HTTP 200 without requiring a ChatGPT or
other account before store submission.
