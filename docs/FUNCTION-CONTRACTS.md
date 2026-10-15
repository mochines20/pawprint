# Pawprint Function Contracts

These contracts describe the functions the MVP needs. They are implementation-neutral, but the names and behaviours are intended to become the service-layer API. A later implementation can expose them through HTTP routes, server actions, or background jobs.

## Shared types

```ts
type UUID = string;
type ISODateTime = string; // UTC, ISO-8601
type Visibility = "public" | "friends" | "private";
type StreakKind = "spotting" | "explorer";
type ValidationStatus = "pending" | "accepted" | "rejected" | "needs_review";

type ApproximateArea = {
  geohash: string;
  barangay?: string;
  city?: string;
  region: string;
};

type ValidationResult = {
  status: ValidationStatus;
  catDetected: boolean;
  personDetected: boolean;
  screenshotDetected: boolean;
  duplicateOf?: UUID;
  suggestedCoatType?: string;
  confidence?: number;
  reasons: string[];
};

type RewardResult = {
  xpAwarded: number;
  badgesEarned: UUID[];
  journalEntryId: UUID;
  streaks: { spotting: number; explorer: number };
};
```

## Capture and sighting functions

### `startCaptureSession`

```ts
startCaptureSession(input: {
  userId: UUID;
  deviceTimeZone: string;
  cameraPermission: "granted" | "denied" | "unknown";
  locationPermission: "granted" | "denied" | "unknown";
}): Promise<{ sessionId: UUID; expiresAt: ISODateTime }>;
```

Rules:

- Only a camera-origin session can submit a reward-eligible sighting.
- Reject the session if camera or location permission is not granted.
- Save the user's current device time zone for diagnostics, but use the profile's saved time zone for streak calculations.
- Do not accept a client-supplied capture timestamp as authoritative.

### `submitSighting`

```ts
submitSighting(input: {
  userId: UUID;
  captureSessionId: UUID;
  imageBlobId: string;
  capturedAt: ISODateTime;
  latitude: number;
  longitude: number;
  description: string; // 8–280 characters, written before publish
  visibility?: Visibility;
  idempotencyKey: string;
}): Promise<{
  sightingId: UUID;
  status: ValidationStatus;
  validation: ValidationResult;
  rewards?: RewardResult;
}>;
```

Rules:

- Verify the session belongs to the user and has not expired or been used.
- Validate coordinate range, capture freshness, rate limits, and the idempotency key.
- Store the precise coordinate in a restricted column or protected table. Derive the public geohash server-side.
- Set `expiresAt = uploadedAtUtc + 24 hours`; never calculate expiry from the user's local date.
- Do not award XP, rarity, badges, or streak credit before validation is accepted.
- Publish only after the configured delay and only if the sighting is not private.
- The default public-map delay is 5 minutes; public eligibility ends 24 hours after upload.
- Store the description with the sighting and show it in the map detail popup without exposing precise GPS.

### `deleteSighting`

```ts
deleteSighting(input: { userId: UUID; sightingId: UUID }): Promise<{
  status: "deleted";
  sightingId: UUID;
}>;
```

Rules:

- Only the sighting owner may delete it.
- Remove the public map eligibility immediately and delete the stored capture plus derived reward/journal links.
- Write an audit event; deletion must be safe to retry when the sighting is already absent.

### `validateSightingImage`

```ts
validateSightingImage(input: {
  sightingId: UUID;
  imageBlobId: string;
  perceptualHash?: string;
}): Promise<ValidationResult>;
```

Required checks:

- Cat detection.
- People/face detection and reject-or-blur decision.
- Screenshot detection.
- Duplicate or near-duplicate image hash.
- Unsafe or prohibited image moderation.
- Coat colour/pattern suggestion and optional breed-type suggestion.

The result is advisory for type classification but authoritative for reward gating once the configured thresholds are met. Low-confidence or conflicting results must enter `needs_review`.

### `getPublicSightings`

```ts
getPublicSightings(input: {
  viewerId?: UUID;
  region: string;
  viewport: { north: number; south: number; east: number; west: number };
  zoom: number;
  nowUtc: ISODateTime;
}): Promise<Array<{
  id: UUID;
  approximateArea: ApproximateArea;
  thumbnailUrl: string;
  coatType?: string;
  expiresAt: ISODateTime;
}>>;
```

Rules:

- Return only accepted sightings where `publishedAt <= nowUtc < expiresAt`.
- Enforce the configured publication delay.
- Never return precise latitude/longitude.
- Cluster by geohash at lower zoom levels.
- Apply visibility and block rules.
- Do not return sightings from private property or removed content.

### `expireSightings`

```ts
expireSightings(input: { nowUtc: ISODateTime; batchSize: number }): Promise<{
  expiredCount: number;
  journalizedCount: number;
  nextCursor?: string;
}>;
```

The job must be safe to retry. Expiry removes public eligibility and writes/updates the owner's Journal entry without deleting the user's retained Journal record.

## Journal, rewards, and streak functions

### `recordJournalEntry`

```ts
recordJournalEntry(input: {
  userId: UUID;
  catId: UUID;
  sightingId: UUID;
  spottedAtUtc: ISODateTime;
}): Promise<{ journalEntryId: UUID; firstSpotted: boolean }>;
```

Use a unique constraint on `(userId, catId)` for the first-spotted record, plus a separate sighting history if repeated observations are retained. Retries must not create duplicate rewards.

### `updateStreaks`

```ts
updateStreaks(input: {
  userId: UUID;
  validSightingAtUtc: ISODateTime;
  savedTimeZone: string;
  catId: UUID;
  areaGeohash: string;
}): Promise<{
  spotting: { current: number; best: number; freezeUsed: boolean };
  explorer: { current: number; best: number; freezeUsed: boolean };
}>;
```

Rules:

- Convert the event to the user's saved time zone before determining the local day.
- Credit each streak at most once per local day.
- Explorer credit requires a new cat or new area for that user on that local day.
- Apply a scheduled Rest Day before consuming a Freeze.
- A Freeze is limited to one free pass per week and must be consumed automatically only when the policy says the missed day is recoverable.
- Preserve `best` even when `current` resets.

### `calculateRegionalRarity`

```ts
calculateRegionalRarity(input: {
  region: string;
  lookbackStartUtc: ISODateTime;
  lookbackEndUtc: ISODateTime;
}): Promise<{ updatedTypeCount: number; calculatedAtUtc: ISODateTime }>;
```

Calculate regional and global rarity separately from recent accepted sightings. Store the tier and calculation time so a past Journal entry remains explainable when rarity changes.

### `awardRewards`

```ts
awardRewards(input: {
  userId: UUID;
  sightingId: UUID;
  firstForJournal: boolean;
  regionalTier: "common" | "uncommon" | "rare" | "super_rare";
  validForStreak: boolean;
}): Promise<RewardResult>;
```

Reward policy must be data-driven and idempotent. No reward is awarded for rejected, duplicate, screenshot, unsafe, or gallery-originated submissions.

## Safety and moderation functions

### `createCareFlag`

```ts
createCareFlag(input: {
  reporterId: UUID;
  sightingId: UUID;
  kind: "thin" | "injured" | "pregnant" | "lone_kitten" | "other";
  note?: string;
}): Promise<{ careFlagId: UUID; status: "open" }>;
```

Care Flags are reports of concern, not medical diagnoses. The UI and API must use non-diagnostic language and protect reporter identity where appropriate.

### `createReport`

```ts
createReport(input: {
  reporterId: UUID;
  targetType: "sighting" | "user" | "care_flag";
  targetId: UUID;
  reason: "unsafe_location" | "harmful_content" | "abuse" | "spam" | "privacy" | "other";
  note?: string;
}): Promise<{ reportId: UUID; status: "open" }>;
```

Reports need rate limits, a status history, reviewer identity, and an audit event. Removal must immediately suppress public visibility without destroying evidence needed for review.

### `blockUser`

```ts
blockUser(input: { userId: UUID; blockedUserId: UUID }): Promise<void>;
```

Blocking must be enforced in map, profile, Journal-sharing, reactions, and friend/group queries once those features exist.

## Privacy and account lifecycle functions

### `updatePrivacySettings`

```ts
updatePrivacySettings(input: {
  userId: UUID;
  defaultVisibility: Visibility;
  showAgeGroup: boolean;
  allowFriendRequests: boolean;
}): Promise<void>;
```

Default visibility is Friends unless the product decision changes. Exact age, email, phone, address, and workplace are not public profile fields.

### `exportUserData`

```ts
exportUserData(input: { userId: UUID }): Promise<{
  exportId: UUID;
  status: "queued" | "ready";
  downloadUrl?: string;
}>;
```

Export user-owned profile data, sightings, Journal, Paw Calendar, badges, streaks, reports, and consent/audit records that are legally exportable. Use an expiring download URL.

### `deleteUserAccount`

```ts
deleteUserAccount(input: { userId: UUID; confirmation: string }): Promise<{
  deletionId: UUID;
  status: "queued" | "completed";
}>;
```

Deletion must cover account data, original photos, thumbnails, precise coordinates, Journal, Paw Calendar, derived rewards, caches, search indexes, and analytics identifiers according to the retention policy. Preserve only information that must legally or operationally remain, and document why.

## Scheduled jobs

| Job | Cadence | Idempotency requirement |
|---|---|---|
| Expire sightings | Every few minutes | Re-running never duplicates Journal entries or rewards. |
| Recalculate rarity | Scheduled, initially daily | Same input window produces the same stored calculation. |
| Streak rollover | Per time zone or hourly sweep | A user cannot lose a streak twice or consume two Freezes. |
| Leaderboard reset | Later roadmap | Reset is atomic and auditable. |
| Notification reminder | Later MVP slice | Must respect user locale, quiet hours, and opt-out. |

## Error codes

Use stable, translatable codes rather than exposing provider or database messages.

`AUTH_REQUIRED`, `FORBIDDEN`, `SESSION_INVALID`, `SESSION_USED`, `LOCATION_REQUIRED`, `CAMERA_REQUIRED`, `INVALID_COORDINATE`, `PRIVATE_PROPERTY`, `IMAGE_NOT_A_CAT`, `PERSON_DETECTED`, `SCREENSHOT_DETECTED`, `DUPLICATE_IMAGE`, `UNSAFE_IMAGE`, `VALIDATION_PENDING`, `RATE_LIMITED`, `SIGHTING_EXPIRED`, `REPORT_NOT_ALLOWED`, `EXPORT_IN_PROGRESS`, and `DELETION_IN_PROGRESS`.

## Minimum test matrix

1. Submit one valid camera sighting and verify exactly one Journal entry, reward, and streak credit.
2. Retry the same idempotency key and verify no duplicate side effects.
3. Submit a gallery image and verify no streak or rarity credit.
4. Submit a screenshot, duplicate, non-cat, people-containing, and unsafe image.
5. Query the map before publication delay, during the 24-hour window, and one second after expiry.
6. Verify precise GPS is never present in a public response.
7. Verify a user crossing local midnight receives the correct local-day credit while stored timestamps remain UTC.
8. Verify Rest Day takes precedence over Freeze and Freeze is not consumed twice.
9. Verify public, Friends, and Private visibility plus block filtering.
10. Verify account deletion removes original media, derived Journal/calendar records, and public visibility.
