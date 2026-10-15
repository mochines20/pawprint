# Pawprint

Pawprint is a browser-first progressive web app for photographing street cats, collecting sightings, and helping protect cats through privacy-aware community features.

## Current project status

The browser-first product slice is now backed by a Cloudflare Worker deployment. The site uses platform identity headers for authentication, D1 for structured data, R2 for private photo storage, browser camera and geolocation APIs for capture, and a privacy-safe geohash center for public map results.

## Documentation

- [Sprint 01: Documentation and Core Functions](docs/SPRINT-01-DOCUMENTATION-AND-FUNCTIONS.md)
- [Function Contracts](docs/FUNCTION-CONTRACTS.md)

## Runtime implementation

- `worker/index.template.js` contains the API and privacy boundary.
- `drizzle/0000_initial.sql` creates users, sightings, journal, care, reports, blocks, and audit tables.
- `scripts/build.sh` embeds the browser UI into the Worker artifact.
- `scripts/validate-artifact.mjs` checks that the deploy package is Worker-backed and has D1/R2 bindings.

The AI boundary accepts `AI_VALIDATION_URL` and `AI_VALIDATION_TOKEN` as Site runtime secrets. Until those are configured with the chosen vision provider, captures are stored as `needs_review` and are not published as accepted public sightings. `EXPIRY_JOB_TOKEN` protects the expiry endpoint.
