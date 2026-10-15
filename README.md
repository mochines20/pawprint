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

The AI boundary uses the server-side `GEMINI_API_KEY` secret with `GEMINI_MODEL=gemini-2.5-flash` for cat/person/screenshot/duplicate-safety checks. The provider key is never sent to the browser; rejected or uncertain captures do not earn XP or appear publicly. `AI_VALIDATION_URL` and `AI_VALIDATION_TOKEN` remain supported as a provider-neutral fallback. `EXPIRY_JOB_TOKEN` protects the expiry endpoint.

The platform endpoints now include `/api/map` (zoom-aware privacy-safe clusters), `/api/progress`, `/api/leaderboards`, `/api/calendar`, `/api/notifications`, `/api/wrapped`, `/api/share-card`, `/api/community`, `/api/rescue-requests`, `/api/community-assets`, and admin-only analytics/moderation/partner report reads. The browser registers `/sw.js` and advertises `/manifest.webmanifest` for installable PWA behavior with an offline shell fallback.
