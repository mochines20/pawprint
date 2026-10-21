# Pawprint Mobile (Expo + React Native + TypeScript)

Layout code for the Pawprint app. Runs without a backend: mock data is used until Supabase is configured.

## Run
```bash
npm install
npx expo install --fix          # align every native package with your Expo SDK
cp .env.example .env            # fill in Supabase URL and anon key (optional for layouts)
npx expo start
```
`react-native-maps`, `expo-camera` and `@gorhom/bottom-sheet` need a **development build** on some setups (`npx expo run:android` or `eas build --profile development`). Expo Go works for most screens.

## Structure
```
App.tsx                      fonts, theme, launch screen, onboarding + auth gating
src/theme                    palette (light/dark), fonts, spacing
src/components               Card, Button, Chip, CatAvatar, PinMarker, TabBar, ...
src/navigation               root stack (modals) + bottom tabs with centre camera button
src/screens                  Launch, Onboarding, Auth, Home, Spot, Reward, Journal, Care, CareFlag, Profile
src/lib                      supabase client, api (mock fallback), brevo helper, map style
supabase/functions/send-email  Brevo email via Edge Function (API key stays server-side)
supabase/schema.sql          tables, RLS, public pin view
```

## Notes
- **Brevo**: never put the API key in the app. The app calls `send-email`; the function calls Brevo.
- **Privacy**: the client never receives exact coordinates. Pins come from `sightings_public` (rounded, delayed, expiring).
- **Mascot**: `CatAvatar` is a head-only react-native-svg port. For the full-body poses, export the SVGs and load them with `react-native-svg-transformer`.
- **Reanimated 4** needs the `react-native-worklets` package (listed by `expo install`). The babel plugin is already set.
