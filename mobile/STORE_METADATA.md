# Pawprint store privacy and release metadata

Use the public links below in the Apple App Store and Google Play console. The app must keep these links reachable without signing in.

- Privacy policy: https://pawprint-omega.vercel.app/privacy
- Terms of use: https://pawprint-omega.vercel.app/terms
- Support: https://pawprint-omega.vercel.app/support
- Account deletion: https://pawprint-omega.vercel.app/support#account-deletion
- Support email: hello.pawprint.app@gmail.com

## Apple App Store privacy answers

Declare data that is collected and linked to the user:

- Contact info: email address, used for account authentication and requested service email.
- User content: cat photos, Journal notes, Care Flags, reports, and nickname.
- Location: approximate location for nearby map display and capture-time location for a submitted sighting. No background location tracking.
- Identifiers: account identifier and device/session identifiers needed for authentication, push notifications, and abuse prevention.

Do not declare tracking. Pawprint does not sell data or use it for third-party advertising. Photos and exact capture points are used for the app service and safety review; exact points are never returned to other users. Gallery photos remain private and do not earn XP or streak credit.

## Google Play Data Safety answers

- Collects: email, account/profile information, user-generated content, photos, approximate and precise location at capture time, app activity, and diagnostics needed to operate the service.
- Shared with service providers: Supabase for authentication/database/storage, Brevo for requested email delivery, Vercel for website hosting, and configured AI validation infrastructure for submitted photos.
- Purpose: app functionality, authentication, safety/fraud prevention, analytics only where consented, and account/service messages.
- Encryption: data is encrypted in transit; account data is protected by authenticated access and server-side row-level access controls.
- Deletion: users can delete their account in Profile or request deletion through the public Support page. Account deletion removes profile, Journal, sightings, exact capture points, and stored photos; moderation evidence is retained in anonymized form when needed for safety.
- No sale of personal data.

## Age and permissions

- Minimum age: 13+. Ages 13–17 require parent or legal guardian permission; under 13 is blocked.
- Camera: required for camera sightings and reward eligibility.
- Location while in use: used once to suggest a city/area and, when submitting a camera sighting, to create an approximate delayed public pin. No background location.
- Photo library: optional; gallery submissions stay private and do not receive public-pin, XP, or streak benefits.

Before submission, complete the console forms using the current platform wording and re-check that the Privacy, Support, and deletion URLs return HTTP 200 in production.
