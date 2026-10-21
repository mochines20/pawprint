import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { AppText, Button, Card } from '@/components';
import { updateProfile } from '@/lib/api';
import { useAppFlow } from '@/navigation/AppFlow';
import { border, font, radius, space, useTheme } from '@/theme';

const AGE_OPTIONS = [
  { value: 'under_18', label: 'Under 18' },
  { value: '18_24', label: '18–24' },
  { value: '25_34', label: '25–34' },
  { value: '35_44', label: '35–44' },
  { value: '45_54', label: '45–54' },
  { value: '55_plus', label: '55+' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

const GENDER_OPTIONS = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
] as const;

export function ProfileSetupScreen() {
  const t = useTheme();
  const { finishProfileSetup } = useAppFlow();
  const [ageGroup, setAgeGroup] = useState<string>('');
  const [gender, setGender] = useState<string>('prefer_not_to_say');
  const [locationArea, setLocationArea] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const useApproximateArea = async () => {
    setError('');
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) throw new Error('LOCATION_PERMISSION_REQUIRED');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      const place = places[0];
      const parts = [place?.district, place?.city, place?.subregion, place?.region].filter(Boolean).map(String);
      const area = [...new Set(parts)].join(', ');
      if (!area) throw new Error('LOCATION_AREA_NOT_FOUND');
      setLocationArea(area);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(code === 'LOCATION_PERMISSION_REQUIRED' ? 'Location permission was not granted. You can type your city or area instead.' : 'We could not read your area. You can type it instead.');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!ageGroup) {
      setError('Choose an age group to continue.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await updateProfile({
        ageGroup,
        gender,
        locationArea,
        onboardingCompleted: true,
        privacyConsentVersion: '2026-10-21',
        privacyConsentAt: new Date().toISOString(),
      });
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

          <Card>
            <View style={{ gap: space.md }}>
              <View>
                <AppText weight="bold" size={16}>How old are you?</AppText>
                <AppText muted size={12} style={{ marginTop: 2 }}>We use an age group instead of your exact birthday.</AppText>
              </View>
              <OptionGrid options={AGE_OPTIONS} value={ageGroup} onChange={setAgeGroup} />
            </View>
          </Card>

          <Card>
            <View style={{ gap: space.md }}>
              <View>
                <AppText weight="bold" size={16}>How do you identify?</AppText>
                <AppText muted size={12} style={{ marginTop: 2 }}>Optional. Choose “Prefer not to say” if you want.</AppText>
              </View>
              <OptionGrid options={GENDER_OPTIONS} value={gender} onChange={setGender} />
            </View>
          </Card>

          <Card>
            <View style={{ gap: space.md }}>
              <View>
                <AppText weight="bold" size={16}>Where do you usually spot cats?</AppText>
                <AppText muted size={12} style={{ marginTop: 2 }}>City or area only—never enter an exact address.</AppText>
              </View>
              <TextInput value={locationArea} onChangeText={setLocationArea} placeholder="e.g. Alabang, Muntinlupa" placeholderTextColor={t.stone} autoCapitalize="words" style={{ borderWidth: border, borderColor: t.edge, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: 13, backgroundColor: t.card, color: t.ink, fontFamily: font.medium, fontSize: 15 }} />
              <Button small variant="ghost" label={locating ? 'Finding your area…' : 'Use my approximate area'} onPress={() => void useApproximateArea()} disabled={locating} />
              <AppText muted size={11} style={{ lineHeight: 16 }}>Uses device location once to fill the area. Exact coordinates are not saved in your profile.</AppText>
            </View>
          </Card>

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

function OptionGrid({ options, value, onChange }: { options: readonly { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onChange(option.value)} style={{ flexGrow: 1, minWidth: 108, borderWidth: border, borderColor: selected ? t.edge : t.line, borderRadius: radius.button, backgroundColor: selected ? t.amber : t.bg, paddingHorizontal: space.sm, paddingVertical: 10, alignItems: 'center' }}>
            <AppText size={13} weight="semi" color={selected ? t.onAmber : t.ink} style={{ textAlign: 'center' }}>{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
