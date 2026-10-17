# Pawprint production deployment

Pawprint uses Supabase Auth for identity and profile consent, while the Worker
uses Cloudflare D1 for application records and R2 for private photos. The local
preview is deliberately not a database: without `PAWPRINT_API_ORIGIN`, its
state is an in-memory demo and will reset on refresh.

## First deployment

1. Install or authenticate Wrangler.
2. Copy `wrangler.toml.example` to `wrangler.toml` and replace the D1 database ID.
3. Create the resources if they do not exist:

   ```text
   wrangler d1 create pawprint
   wrangler r2 bucket create pawprint-photos
   ```

4. Apply the migrations to the production database:

   ```text
   wrangler d1 migrations apply pawprint --remote
   ```

5. Add the values listed in `.env.example` as Worker vars or secrets. Never put
   `GEMINI_API_KEY`, `BREVO_API_KEY`, `PUSH_PRIVATE_KEY`, or the admin IDs in the
   browser bundle.
6. Deploy:

   ```text
   npm run build
   wrangler deploy
   ```

7. Set `PAWPRINT_API_ORIGIN=https://<worker-domain>` in `.env.local` and restart
   the localhost preview. `/api/health` must report `storageConfigured: true`.

8. Run a public smoke check against the deployed origin:

   ```text
   PowerShell: `$env:PAWPRINT_QA_BASE_URL="https://<worker-domain>"; npm run qa:production`
   ```

## Auth and admin

Set the Supabase redirect URL to the production origin plus `/auth/callback` and
enable Google/Apple only after their provider credentials are configured. Put the
Supabase user UUIDs that may open the admin console in `ADMIN_USER_IDS`, separated
by commas.

## Scheduled jobs

The Worker cron handler runs expiry cleanup every five minutes and the daily
maintenance hook once per day, including a 30-day regional rarity snapshot.
The authenticated HTTP endpoint
`POST /api/jobs/expire` remains available for manual verification with
`Authorization: Bearer <EXPIRY_JOB_TOKEN>`.

## Email and push

Waitlist signups are persisted first. If Brevo is configured, Pawprint then sends
a confirmation email; a Brevo outage does not discard the signup. Web Push
subscriptions are stored in D1 and can be sent by a Web Push-compatible worker
using the configured VAPID keys. The browser gracefully falls back to in-app and
Brevo email notifications when push is unavailable.
