# Pawprint

Pawprint is a browser-first progressive web app for photographing street cats, collecting sightings, and helping protect cats through privacy-aware community features.

## Current project status

The browser-first product slice uses Supabase as its backend. Supabase Auth owns magic-link, Google, and Apple authentication; the `pawprint-api` Edge Function verifies bearer tokens and never stores passwords or provider tokens. Supabase Postgres stores application data, Supabase Storage stores private photos, browser camera and geolocation APIs power capture, and public map results use privacy-safe geohash centers.

## Documentation

- [Sprint 01: Documentation and Core Functions](docs/SPRINT-01-DOCUMENTATION-AND-FUNCTIONS.md)
- [Function Contracts](docs/FUNCTION-CONTRACTS.md)
- [Supabase Auth setup and profile RLS](docs/SUPABASE-AUTH-SETUP.md)
- [Supabase profile migration](docs/supabase-auth.sql)
- [Supabase application setup](docs/SUPABASE-APP-SETUP.md)

## Runtime implementation

- `supabase/functions/pawprint-api/index.ts` contains the API and privacy boundary.
- `supabase/migrations/20261017000000_pawprint_app.sql` creates the application tables, RLS boundaries, and private photo bucket.
- `scripts/local-preview-server.mjs` proxies `/api/*` to the Supabase Edge Function during local development.
- `scripts/validate-artifact.mjs` validates the browser package; Supabase deployment is independent of the static host.

The AI boundary uses a server-side provider for real-cat, person, screenshot, unsafe-content, duplicate, and AI-generated-image checks. Gemini remains supported through `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-2.5-flash`; Qwen through Ollama is supported with `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `OLLAMA_API_MODE=native` or `openai`. Basic auth can be supplied with `OLLAMA_USERNAME`/`OLLAMA_PASSWORD`, or a bearer token with `OLLAMA_API_TOKEN`. The provider credentials are never sent to the browser; rejected or uncertain captures do not earn XP, enter the Journal, or appear publicly. `AI_CAT_CONFIDENCE_THRESHOLD` and `AI_GENERATED_CONFIDENCE_THRESHOLD` control the acceptance gate. `AI_VALIDATION_URL` and `AI_VALIDATION_TOKEN` remain supported as a provider-neutral fallback. `EXPIRY_JOB_TOKEN` protects the expiry endpoint.

Supabase Auth and the privacy-limited `profiles` table remain the identity/profile source of truth. The Edge Function stores application records in Postgres and private originals in Supabase Storage; the browser never writes privileged data directly. Configure the Supabase Edge Function secrets and run the application migration before production capture. If the AI provider is missing or unavailable, submissions are saved as `needs_review` without rewards or public visibility rather than being accepted blindly.

The platform endpoints now include `/api/map` (zoom-aware privacy-safe clusters), `/api/progress`, `/api/leaderboards`, `/api/calendar`, `/api/notifications`, `/api/wrapped`, `/api/share-card`, `/api/community`, `/api/rescue-requests`, `/api/community-assets`, and admin-only analytics/moderation/partner report reads. The browser registers `/sw.js` and advertises `/manifest.webmanifest` for installable PWA behavior with an offline shell fallback.

The Supabase API exposes Brevo-backed waitlist confirmation, Web Push subscription registration, a protected admin moderation console, and the API hooks needed by scheduled maintenance. The local preview proxies API calls to `PAWPRINT_SUPABASE_FUNCTION_URL`; otherwise it remains an intentionally resettable preview.

Progress also returns six XP medals (`Paw Seed` through `Pawprint Legend`). Their thresholds are enforced by the Supabase API and earned IDs are persisted in `user_badges`, while the browser renders the medal artwork as inline sketch-style SVGs alongside the cat avatar system.

Progress also exposes Easter rewards for special actions: 20 accepted cats in one local day (`Cat Marathon`), an accepted Rare/Super Rare pattern (`Rare Find`), and a submitted care signal (`Gentle Helper`). These rewards use the same persisted badge table and are never granted from client-only counters.
