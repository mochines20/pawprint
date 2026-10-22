# Staging validation fixture

The accepted-cat fixture exists only for a non-production QA deployment. It is disabled unless all of these are true:

- `PAWPRINT_RUNTIME=staging`
- `PAWPRINT_QA_VALIDATION_FIXTURE=accepted-cat` (or `needs-review-cat`)
- `SUPABASE_URL` does not point at the production project ref

Never set the fixture variable in production. It bypasses the external AI provider only for staging QA so the accepted-upload branch can be tested deterministically.

Run `scripts/qa-staging-streak-freeze.mjs` against a staging Supabase project and staging API base URL. The script seeds a two-day gap with one freeze, uploads the staging accepted-cat fixture, and verifies that the API returns an accepted sighting with the streak incremented and the freeze count decremented.
