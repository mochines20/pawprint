import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import * as Location from 'expo-location';
import { AppText, Button, Card, ProfileDetailsForm } from '@/components';
import type { AvatarId } from '@/lib/avatarCatalog';
import { areaFromGeocoder, AREA_OPTIONS, generateNickname, validateNickname } from '@/lib/profileOptions';
import { updateProfile } from '@/lib/api';
import { useAppFlow } from '@/navigation/AppFlow';
import { space, useTheme } from '@/theme';

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), milliseconds);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

export function ProfileSetupScreen() {
  const t = useTheme();
  const { finishProfileSetup } = useAppFlow();
  const [nickname, setNickname] = useState(generateNickname());
  const [avatarId, setAvatarId] = useState<AvatarId>('cat-ink');
  const [spotterType, setSpotterType] = useState('casual');
  const [ageGroup, setAgeGroup] = useState<string>('');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [locationArea, setLocationArea] = useState('');
  const [streakReminders, setStreakReminders] = useState(false);
  const [careFlagReminders, setCareFlagReminders] = useState(false);
  const [safetyPledge, setSafetyPledge] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const useApproximateArea = async () => {
    setError('');
    setLocating(true);
    try {
      if (Platform.OS === 'web') {
        setError('Automatic location is available in the mobile build. Type your city or area in this browser preview.');
        return;
      }
      const permission = await withTimeout(Location.requestForegroundPermissionsAsync(), 6000);
      if (permission.status !== Location.PermissionStatus.GRANTED) throw new Error('LOCATION_PERMISSION_REQUIRED');
      const lastKnown = await withTimeout(Location.getLastKnownPositionAsync(), 2500).catch(() => null);
      const position = lastKnown ?? await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 8000);
      const places = await withTimeout(Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude }), 8000);
      const place = places[0];
      const parts = [place?.district, place?.city, place?.subregion, place?.region].filter(Boolean).map(String);
      const area = areaFromGeocoder(parts);
      if (!area) throw new Error('LOCATION_AREA_NOT_FOUND');
      setLocationArea(area);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(code === 'LOCATION_PERMISSION_REQUIRED' ? 'Location permission was not granted. You can type your city or area instead.' : code === 'LOCATION_TIMEOUT' ? 'Location lookup took too long. Type your city or area instead.' : 'We could not read your area. You can type it instead.');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    const nicknameError = validateNickname(nickname);
    if (nicknameError) {
      setError(nicknameError);
      return;
    }
    if (!ageGroup) {
      setError('Choose an age group to continue.');
      return;
    }
    if (ageGroup === 'under_13') {
      setError('Pawprint is for people aged 13 and above.');
      return;
    }
    if (ageGroup === '13_17' && !guardianConsent) {
      setError('Parent or legal guardian permission is required for ages 13–17.');
      return;
    }
    if (!AREA_OPTIONS.some((area) => area.toLowerCase() === locationArea.trim().toLowerCase())) {
      setError('Choose a city or area from the suggestions. Exact addresses are not accepted.');
      return;
    }
    if (!safetyPledge || !consentAccepted) {
      setError('Accept the safety pledge and Terms & Privacy consent to continue.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const savedProfile = await updateProfile({
        displayName: nickname.trim(),
        avatarUrl: avatarId,
        catSpotterType: spotterType,
        ageGroup,
        locationArea,
        guardianConsent,
        streakReminders,
        careFlagReminders,
        safetyPledgeAccepted: safetyPledge,
        termsAcceptedAt: new Date().toISOString(),
        onboardingCompleted: true,
        privacyConsentVersion: '2026-10-22',
        privacyConsentAt: new Date().toISOString(),
      });
      if (!savedProfile.onboarding_completed) throw new Error('PROFILE_SAVE_NOT_CONFIRMED');
      finishProfileSetup();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.xl, paddingVertical: space.xxl }} keyboardShouldPersistTaps="handled">
        <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center', gap: space.lg }}>
          <View>
            <AppText size={30} weight="bold">Make Pawprint yours</AppText>
            <AppText muted size={14} style={{ marginTop: space.xs, lineHeight: 20 }}>A few details help us personalize your experience. You can change them later in Profile.</AppText>
          </View>

          <ProfileDetailsForm
            nickname={nickname} onNicknameChange={setNickname} onSuggestNickname={() => setNickname(generateNickname())}
            avatarId={avatarId} onAvatarChange={setAvatarId} spotterType={spotterType} onSpotterTypeChange={setSpotterType}
            ageGroup={ageGroup} onAgeChange={(value) => { setAgeGroup(value); setError(''); }} guardianConsent={guardianConsent} onGuardianConsentChange={(value) => { setGuardianConsent(value); setError(''); }}
            locationArea={locationArea} onLocationChange={(value) => { setLocationArea(value); setError(''); }} onAreaSelect={(value) => { setLocationArea(value); setError(''); }} locating={locating} onUseLocation={() => void useApproximateArea()}
            streakReminders={streakReminders} onStreakRemindersChange={setStreakReminders} careFlagReminders={careFlagReminders} onCareFlagRemindersChange={setCareFlagReminders}
            safetyPledge={safetyPledge} onSafetyPledgeChange={setSafetyPledge} consentAccepted={consentAccepted} onConsentAcceptedChange={setConsentAccepted}
          />

          <Card dark>
            <AppText color={t.amber} size={12} weight="bold" upper>Private by default</AppText>
            <AppText color="#F5F3ED" size={13} style={{ marginTop: 6, lineHeight: 19 }}>Your exact location is never shown publicly. Public pawprints use an approximate area and a safety delay.</AppText>
          </Card>

          {error ? <AppText color={t.red} size={13} style={{ textAlign: 'center' }}>{error}</AppText> : null}
          <Button label={busy ? 'Saving your profile…' : 'Continue to Pawprint'} onPress={save} disabled={busy} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
