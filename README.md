# Pawprint

Pawprint is a browser-first progressive web app for photographing street cats, collecting sightings, and helping protect cats through privacy-aware community features.

## Current project status

The browser-first product slice is now backed by a Cloudflare Worker deployment. Supabase Auth owns magic-link, Google, and Apple authentication; the Worker verifies Supabase bearer tokens and never stores passwords or provider tokens. D1 stores application data, R2 stores private photos, browser camera and geolocation APIs power capture, and public map results use privacy-safe geohash centers.

## Documentation

- [Sprint 01: Documentation and Core Functions](docs/SPRINT-01-DOCUMENTATION-AND-FUNCTIONS.md)
- [Function Contracts](docs/FUNCTION-CONTRACTS.md)
- [Supabase Auth setup and profile RLS](docs/SUPABASE-AUTH-SETUP.md)
- [Supabase profile migration](docs/supabase-auth.sql)

## Runtime implementation

- `worker/index.template.js` contains the API and privacy boundary.
- `drizzle/0000_initial.sql` creates users, sightings, journal, care, reports, blocks, and audit tables.
- `scripts/build.sh` embeds the browser UI into the Worker artifact.
- `scripts/validate-artifact.mjs` checks that the deploy package is Worker-backed and has D1/R2 bindings.
- `wrangler.toml.example` and `docs/PRODUCTION-DEPLOYMENT.md` contain the repeatable D1/R2/cron deployment setup.

The AI boundary uses a server-side provider for real-cat, person, screenshot, unsafe-content, duplicate, and AI-generated-image checks. Gemini remains supported through `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-2.5-flash`; Qwen through Ollama is supported with `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and `OLLAMA_API_MODE=native` or `openai`. Basic auth can be supplied with `OLLAMA_USERNAME`/`OLLAMA_PASSWORD`, or a bearer token with `OLLAMA_API_TOKEN`. The provider credentials are never sent to the browser; rejected or uncertain captures do not earn XP, enter the Journal, or appear publicly. `AI_CAT_CONFIDENCE_THRESHOLD` and `AI_GENERATED_CONFIDENCE_THRESHOLD` control the acceptance gate. `AI_VALIDATION_URL` and `AI_VALIDATION_TOKEN` remain supported as a provider-neutral fallback. `EXPIRY_JOB_TOKEN` protects the expiry endpoint.

Supabase Auth and the privacy-limited `profiles` table remain the identity/profile source of truth. In the existing Cloudflare deployment, application records are durably stored in D1 and private originals in R2 through the Worker; the browser never writes privileged data directly. Configure the D1/R2 bindings and the server-only AI secret before production capture. If the AI provider is missing or unavailable, submissions are saved as `needs_review` without rewards or public visibility rather than being accepted blindly.

The platform endpoints now include `/api/map` (zoom-aware privacy-safe clusters), `/api/progress`, `/api/leaderboards`, `/api/calendar`, `/api/notifications`, `/api/wrapped`, `/api/share-card`, `/api/community`, `/api/rescue-requests`, `/api/community-assets`, and admin-only analytics/moderation/partner report reads. The browser registers `/sw.js` and advertises `/manifest.webmanifest` for installable PWA behavior with an offline shell fallback.

The production Worker also exposes Brevo-backed waitlist confirmation, Web Push subscription registration, a protected admin moderation console, and a five-minute scheduled expiry job. The local preview can proxy all API calls to a deployed Worker through `PAWPRINT_API_ORIGIN`; otherwise it remains an intentionally resettable preview.

Progress also returns six XP medals (`Paw Seed` through `Pawprint Legend`). Their thresholds are stored in the Worker catalog and earned IDs are persisted in D1's `user_badges` table, while the browser renders the medal artwork as inline sketch-style SVGs alongside the cat avatar system.

Progress also exposes Easter rewards for special actions: 20 accepted cats in one local day (`Cat Marathon`), an accepted Rare/Super Rare pattern (`Rare Find`), and a submitted care signal (`Gentle Helper`). These rewards use the same persisted badge table and are never granted from client-only counters.
