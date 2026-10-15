# Sprint 01: Documentation and Core Functions

**Sprint length:** 2 weeks (proposed)  
**Goal:** make the Pawprint MVP implementation-ready by documenting the domain, defining the core service contracts, and agreeing on the safety and privacy rules that every function must enforce.

## Sprint outcome

At the end of this sprint, the team should have:

1. A shared MVP scope and glossary.
2. A documented data model for users, sightings, cats, journals, streaks, rarity, care flags, and reports.
3. Stable contracts for the core functions and API operations.
4. Explicit privacy, anti-cheat, moderation, expiry, and time-zone rules.
5. Test cases for the highest-risk behaviours.
6. A follow-on implementation backlog for the actual PWA and backend.

## Product rules to treat as invariants

These rules come from the product documentation and must not be weakened by individual feature implementations.

### Sighting lifecycle

- A sighting must originate from the in-app camera. Gallery uploads do not qualify for streaks or rarity.
- The photo must contain a cat, must not be a duplicate or screenshot, and must not expose people; faces are rejected or auto-blurred.
- GPS is captured at the moment of capture. The precise coordinate is private and is never returned to other users.
- Public map data uses an approximate area of roughly 100–200 metres and is published after a short delay.
- Public visibility ends exactly 24 hours after the UTC upload timestamp.
- Expired sightings remain in the spotter's private Cat Journal.

### Time and streaks

- All stored timestamps are UTC.
- The spotting day is calculated from the user's saved local time zone and local midnight.
- One valid sighting per local day maintains the Spotting Streak.
- The Explorer Streak requires a new cat or new area on each day.
- One Streak Freeze is available per week and is automatically used for a missed day.
- A Rest Day must be scheduled in advance and does not consume a Freeze.

### Safety and privacy

- Public, Friends, and Private are the visibility options; Friends is the default.
- Other users see only a barangay or city in profile/calendar views, and only after the relevant pins expire.
- No pin may be created for private property or a location reported as risky.
- Care Flags and rescue-related functions are never paywalled.
- AI health hints may suggest a Care Flag but must never present a diagnosis.
- Account deletion removes the user's photos, Journal, and Paw Calendar.

## MVP scope for this sprint

### In scope

- User profile with nickname, avatar, age group, home time zone, language, privacy settings, and notification preference.
- In-app capture session and sighting submission.
- AI/image validation contract: cat detection, people detection/blur, screenshot detection, duplicate hash, and type suggestion.
- Approximate map query with clustering-ready geohash data, delay, and 24-hour expiry.
- Cat Journal entry creation and retrieval.
- Spotting and Explorer streak calculations, Freeze, Rest Day, and best streak.
- Cat type and regional/global rarity model.
- Basic badges and XP ledger.
- Care Flag and user report submission.
- Block/report controls.
- Data export and account deletion contracts.
- English-first strings with a translation key convention for Filipino, Spanish, and Japanese.

### Out of scope for Sprint 01

Daily Quests, Levels, Cat Naming, Cat Profile Cards, Reactions, Local Groups, Friends Calendar, leaderboards, rescue requests, vet finder, TNR, feeding stations, adoption, events, Wrapped, Share Cards, and premium cosmetics. These belong in later implementation slices after the core loop is validated.

## Work breakdown

| ID | Work item | Acceptance criteria | Owner |
|---|---|---|---|
| DOC-01 | Publish MVP glossary and scope | Terms such as sighting, cat, journal entry, region, expiry, visibility, and valid photo are defined in one place. | Product |
| DOC-02 | Document data model | Tables, fields, ownership, retention, and indexes are recorded; all timestamps specify UTC or user-local interpretation. | Backend |
| DOC-03 | Document function contracts | Core functions define inputs, outputs, validation failures, authorization, and idempotency. | Backend |
| DOC-04 | Document privacy and safety rules | Location approximation, delayed publishing, private property, reports, deletion, and age handling are explicit. | Product + Legal |
| DOC-05 | Create test matrix | Happy paths and abuse cases cover capture, expiry, duplicate uploads, time zones, Freeze, Rest Day, visibility, and deletion. | QA |
| FUNC-01 | Capture/session contract | A capture session records camera origin, capture time, device time zone, and location permission state. | Frontend |
| FUNC-02 | Sighting validation pipeline | Submission cannot award XP, rarity, or streak credit until all validation gates pass. | Backend + AI |
| FUNC-03 | Map and expiry functions | Public queries exclude expired or delayed rows; the expiry job archives public visibility without deleting the Journal record. | Backend |
| FUNC-04 | Journal and streak functions | Journal insertion is idempotent; daily streak logic handles local midnight, Freeze, Rest Day, and best streak. | Backend |
| FUNC-05 | Safety/report functions | Users can create Care Flags and reports, and moderation can change status with an audit trail. | Backend + Moderation |
| FUNC-06 | Privacy lifecycle functions | Export and deletion requests are authenticated, auditable, and complete across photos, Journal, calendar, and derived data. | Backend |
| QA-01 | Contract tests | Every function in `FUNCTION-CONTRACTS.md` has validation and authorization tests. | QA |
| QA-02 | Time-zone and expiry tests | Tests cover UTC expiry and at least UTC−8, UTC+0, UTC+8, and UTC+9 user zones. | QA |

## Suggested two-week sequence

### Days 1–2: alignment and domain

- Confirm the MVP scope and open decisions.
- Agree on the glossary and canonical names.
- Confirm the proposed Next.js/Supabase/PostGIS stack.
- Decide minimum age and the pilot's exact Alabang boundary.

### Days 3–5: data and contracts

- Finalize the data model and indexes.
- Implement the validation schemas from the function contracts.
- Define the AI provider adapter so the rest of the system is provider-neutral.
- Define error codes and localization keys.

### Days 6–8: core behaviour

- Build the capture-to-submit flow.
- Implement map visibility, delay, approximate location, and expiry queries.
- Implement Journal insertion and streak calculations.
- Add idempotency keys and audit events.

### Days 9–10: safety, QA, and handoff

- Add Care Flags, reports, blocking, export, and deletion contracts.
- Run contract, time-zone, privacy, and abuse tests.
- Review the user-facing copy and safety tips.
- Demo the complete path: capture → validate → publish → expire → Journal/streak.

## Definition of done

- The documentation matches the agreed MVP and has no contradictory time or location rules.
- Every core write operation has authentication, authorization, validation, idempotency, and audit expectations.
- No public response exposes precise GPS, a private property coordinate, or a live tracking signal.
- Expired sightings disappear from public queries at the correct UTC instant.
- A valid sighting updates the Journal, XP, rarity eligibility, and streak exactly once.
- Invalid, duplicate, screenshot, people-containing, and unsafe submissions do not earn rewards.
- Export and deletion behaviour is documented and testable.
- The core flow has automated tests before UI polish begins.

## Open decisions to resolve before implementation

1. Minimum user age and the corresponding consent flow.
2. Exact delay before a sighting becomes visible on the public map.
3. Whether the pilot uses Friends as the default visibility or a more restrictive default.
4. Exact Alabang boundary and the geospatial definition of a region/barangay.
5. AI provider and the confidence thresholds for cat, person, screenshot, and duplicate checks.
6. Supabase versus another backend, if the recommended stack is not accepted.
7. The first rescue/shelter partner and the emergency routing policy.
8. Retention periods for rejected images, moderation evidence, and audit events.

## Risk register

| Risk | Required mitigation |
|---|---|
| A user uses sightings to locate a cat for harm | Approximate and delayed pins, private-property rejection, reporting, moderation, and fast removal. |
| Users chase or disturb cats | Safety tips, no XP for risky behaviour, and report review. |
| Fake or spam photos farm rewards | In-app capture, AI validation, duplicate hashing, server-side reward gating, and rate limits. |
| Faces or private information appear in photos | Reject or blur before publication; keep originals access-controlled. |
| A quiet pilot area makes the map feel empty | Start in one bounded area and make the private Journal valuable without public activity. |
| Derived data survives deletion | Use a deletion checklist covering object storage, relational rows, caches, search indexes, and analytics. |

## Recommended next implementation slice

Create the repository foundation with a Next.js PWA shell, Supabase migrations for the MVP tables, runtime validation schemas, and a vertical test-first sighting flow. Do not begin with the full roadmap; prove one safe, repeatable core loop first.
