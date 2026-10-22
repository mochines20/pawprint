import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import * as Location from 'expo-location';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Card, CatAvatar, Chip, Icon, PinMarker, ProfileDetailsForm, ProgressBar } from '@/components';
import type { AvatarId } from '@/lib/avatarCatalog';
import { areaFromGeocoder, AREA_OPTIONS, generateNickname, validateNickname } from '@/lib/profileOptions';
import { updateProfile } from '@/lib/api';
import { useAppFlow } from '@/navigation/AppFlow';
import { space, useTheme } from '@/theme';

type Slide = { title: string; body: string; art?: () => React.ReactElement; kind?: 'profile' };

function SpotArt() {
  const t = useTheme();
  return (
    <Card padded={false} style={{ width: 280 }} innerStyle={{ height: 220, backgroundColor: '#3C3F6B', alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ position: 'absolute', left: 12, top: 12 }}><Chip tone="dark" label="Camera only" /></View>
      <View style={{ marginBottom: 14 }}><CatAvatar variant="calico" size={120} radius={30} /></View>
      <View style={{ position: 'absolute', bottom: 10 }}><Chip tone="amber" icon={<Icon name="check" size={14} color={t.onAmber} />} label="Cat detected · Calico · 96%" /></View>
    </Card>
  );
}

function PinArt() {
  const t = useTheme();
  return (
    <Card padded={false} style={{ width: 280 }} innerStyle={{ height: 220, backgroundColor: t.mapLand }}>
      <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
        <Circle cx={100} cy={110} r={44} fill="rgba(255,180,0,0.22)" stroke={t.amberDeep} strokeWidth={2} strokeDasharray="4 4" />
        <Circle cx={200} cy={80} r={38} fill="rgba(255,180,0,0.22)" stroke={t.amberDeep} strokeWidth={2} strokeDasharray="4 4" />
      </Svg>
      <View style={{ position: 'absolute', left: 78, top: 74 }}><PinMarker size={46} /></View>
      <View style={{ position: 'absolute', left: 178, top: 46 }}><PinMarker size={46} fill="#FAF8F4" /></View>
      <View style={{ position: 'absolute', left: 10, top: 10 }}><Chip icon={<Icon name="clock" size={12} color={t.ink} />} label="Public for 24 hours" /></View>
      <View style={{ position: 'absolute', left: 10, bottom: 10 }}><Chip tone="cream" label="Approximate areas · delayed 5 min" /></View>
    </Card>
  );
}

function JournalArt() {
  const t = useTheme();
  return (
    <View style={{ width: 280, gap: 12 }}>
      <Card dark innerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}>
        <CatAvatar variant="orange" size={56} radius={16} />
        <View style={{ flex: 1 }}>
          <AppText size={10.5} color="#BDBAB2">Current streak</AppText>
          <AppText size={28} weight="bold" color={t.amber} style={{ lineHeight: 30 }}>4</AppText>
          <AppText size={10.5} color="#BDBAB2">days in a row</AppText>
        </View>
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <CatAvatar variant="orange" size={44} />
          <View style={{ flex: 1 }}><AppText size={14.5} weight="semi">Orange tabby</AppText><AppText size={12} muted>Today · Muntinlupa</AppText></View>
          <Chip tone="amber" label="+24 XP" />
        </View>
        <View style={{ marginTop: 10 }}><ProgressBar value={72} /></View>
      </Card>
    </View>
  );
}

function CareArt() {
  const t = useTheme();
  return (
    <View style={{ width: 280, gap: 12 }}>
      <Card innerStyle={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <CatAvatar variant="orange" size={84} radius={22} />
        <View style={{ flex: 1 }}>
          <Chip tone="red" label="Care Flag" />
          <AppText size={14} weight="semi" style={{ marginTop: 8 }}>Needs water &amp; shade</AppText>
          <AppText size={12} muted>approximate Muntinlupa area</AppText>
        </View>
        <View style={{ position: 'absolute', right: -2, top: -10 }}><PinMarker size={40} fill={t.red} /></View>
      </Card>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row' }}>
            {(['black', 'calico', 'orange'] as const).map((v, i) => <View key={v} style={{ marginLeft: i ? -10 : 0 }}><CatAvatar variant={v} size={40} radius={13} /></View>)}
          </View>
          <View style={{ flex: 1 }}><AppText size={14} weight="semi">3 neighbours nearby</AppText><AppText size={12} muted>notified · approximate</AppText></View>
        </View>
        <View style={{ marginTop: 10 }}><Chip tone="amber" icon={<Icon name="check" size={14} color={t.onAmber} />} label="Help is on the way" /></View>
      </Card>
    </View>
  );
}

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), milliseconds);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

function ProfileStep(props: {
  nickname: string; onNicknameChange: (value: string) => void; onSuggestNickname: () => void;
  avatarId: AvatarId; onAvatarChange: (value: AvatarId) => void; spotterType: string; onSpotterTypeChange: (value: string) => void;
  ageGroup: string; onAgeChange: (value: string) => void; guardianConsent: boolean; onGuardianConsentChange: (value: boolean) => void;
  locationArea: string; onLocationChange: (value: string) => void; onAreaSelect: (value: string) => void; locating: boolean; onUseLocation: () => void;
  streakReminders: boolean; onStreakRemindersChange: (value: boolean) => void; careFlagReminders: boolean; onCareFlagRemindersChange: (value: boolean) => void;
  safetyPledge: boolean; onSafetyPledgeChange: (value: boolean) => void; consentAccepted: boolean; onConsentAcceptedChange: (value: boolean) => void;
}) {
  return <ScrollView style={{ width: '100%' }} contentContainerStyle={{ gap: 10, paddingBottom: 8 }} keyboardShouldPersistTaps="handled"><ProfileDetailsForm {...props} /></ScrollView>;
}

const SLIDES: Slide[] = [
  { title: 'Spot street cats', body: 'Snap a photo of a cat you meet. Our AI checks that it’s a real cat.', art: SpotArt },
  { title: 'Pin it, safely', body: 'Your pin shows only an approximate area, a few minutes late, and disappears after 24 hours.', art: PinArt },
  { title: 'Build your journal', body: 'Every cat goes into your private Cat Journal. Keep your daily streak, earn XP and medals.', art: JournalArt },
  { title: 'Care for cats', body: 'Spotted a cat in need? Raise a Care Flag so people nearby can step in.', art: CareArt },
  { title: 'Your profile', body: 'Tell us a little about you before you start spotting.', kind: 'profile' },
];

export function OnboardingScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { finishOnboarding, finishProfileSetup } = useAppFlow();
  const list = useRef<FlatList<Slide>>(null);
  const [i, setI] = useState(0);
  const [nickname, setNickname] = useState(generateNickname());
  const [avatarId, setAvatarId] = useState<AvatarId>('cat-ink');
  const [spotterType, setSpotterType] = useState('casual');
  const [ageGroup, setAgeGroup] = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [locationArea, setLocationArea] = useState('');
  const [streakReminders, setStreakReminders] = useState(false);
  const [careFlagReminders, setCareFlagReminders] = useState(false);
  const [safetyPledge, setSafetyPledge] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const last = i === SLIDES.length - 1;

  const next = async () => {
    if (last) {
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
      setSaving(true);
      setError('');
      try {
        const now = new Date().toISOString();
        const savedProfile = await updateProfile({ displayName: nickname.trim(), avatarUrl: avatarId, catSpotterType: spotterType, ageGroup, locationArea, guardianConsent, streakReminders, careFlagReminders, safetyPledgeAccepted: safetyPledge, termsAcceptedAt: now, onboardingCompleted: true, privacyConsentVersion: '2026-10-22', privacyConsentAt: now });
        if (!savedProfile.onboarding_completed) throw new Error('PROFILE_SAVE_NOT_CONFIRMED');
        finishProfileSetup();
        finishOnboarding();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save your profile. Please try again.');
      } finally {
        setSaving(false);
      }
      return;
    }
    const nextIndex = i + 1;
    setI(nextIndex);
    // scrollToOffset is more reliable than scrollToIndex in Expo Web.
    list.current?.scrollToOffset({ offset: width * nextIndex, animated: true });
  };

  const skipIntro = () => {
    const profileIndex = SLIDES.length - 1;
    setI(profileIndex);
    list.current?.scrollToOffset({ offset: width * profileIndex, animated: true });
  };

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

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, minHeight: 48 }}>
        <AppText size={13} muted>{i + 1} of {SLIDES.length}</AppText>
        {!last && <AppText size={14} muted onPress={skipIntro} accessibilityRole="button" style={{ padding: 8 }}>Skip intro</AppText>}
      </View>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => {
          const Art = item.art;
          return (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width, flex: 1 }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: item.kind === 'profile' ? 'flex-start' : 'center', paddingHorizontal: item.kind === 'profile' ? 18 : 28, paddingTop: item.kind === 'profile' ? 8 : 0, gap: 6 }}>
                {item.kind === 'profile' ? (
                  <ProfileStep nickname={nickname} onNicknameChange={(value) => { setNickname(value); setError(''); }} onSuggestNickname={() => { setNickname(generateNickname()); setError(''); }} avatarId={avatarId} onAvatarChange={setAvatarId} spotterType={spotterType} onSpotterTypeChange={setSpotterType} ageGroup={ageGroup} onAgeChange={(value) => { setAgeGroup(value); setError(''); }} guardianConsent={guardianConsent} onGuardianConsentChange={(value) => { setGuardianConsent(value); setError(''); }} locationArea={locationArea} onLocationChange={(value) => { setLocationArea(value); setError(''); }} onAreaSelect={(value) => { setLocationArea(value); setError(''); }} locating={locating} onUseLocation={() => void useApproximateArea()} streakReminders={streakReminders} onStreakRemindersChange={setStreakReminders} careFlagReminders={careFlagReminders} onCareFlagRemindersChange={setCareFlagReminders} safetyPledge={safetyPledge} onSafetyPledgeChange={setSafetyPledge} consentAccepted={consentAccepted} onConsentAcceptedChange={setConsentAccepted} />
                ) : (
                  <><View style={{ marginBottom: 18 }}>{Art ? <Art /> : null}</View><AppText size={30} weight="bold" style={{ textAlign: 'center' }}>{item.title}</AppText><AppText size={16} muted style={{ textAlign: 'center', maxWidth: 300, marginTop: 6 }}>{item.body}</AppText></>
                )}
              </View>
            </KeyboardAvoidingView>
          );
        }}
      />
      <View style={{ alignItems: 'center', gap: 18, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 6 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {SLIDES.map((s, k) => <View key={s.title} style={{ height: 8, width: k === i ? 24 : 8, borderRadius: 8, backgroundColor: k === i ? t.amber : t.line }} />)}
        </View>
        {error ? <AppText color={t.red} size={12} style={{ textAlign: 'center' }}>{error}</AppText> : null}
        <Button label={saving ? 'Saving your profile…' : last ? 'Start spotting' : 'Next'} onPress={() => void next()} disabled={saving} style={{ alignSelf: 'stretch' }} />
      </View>
    </View>
  );
}
