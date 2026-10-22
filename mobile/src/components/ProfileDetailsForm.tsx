import { Linking, Pressable, TextInput, View } from 'react-native';
import type { ReactNode } from 'react';
import { AppText } from './AppText';
import { Button } from './Button';
import { Card } from './Card';
import { CatAvatar } from './CatAvatar';
import { Icon } from './Icon';
import type { AvatarId } from '@/lib/avatarCatalog';
import { areaMatches, AVATAR_OPTIONS, PROFILE_AGE_OPTIONS, SPOTTER_TYPES } from '@/lib/profileOptions';
import { border, font, radius, space, useTheme } from '@/theme';

type Props = {
  nickname: string;
  onNicknameChange: (value: string) => void;
  onSuggestNickname: () => void;
  avatarId: AvatarId;
  onAvatarChange: (value: AvatarId) => void;
  spotterType: string;
  onSpotterTypeChange: (value: string) => void;
  ageGroup: string;
  onAgeChange: (value: string) => void;
  guardianConsent: boolean;
  onGuardianConsentChange: (value: boolean) => void;
  locationArea: string;
  onLocationChange: (value: string) => void;
  onAreaSelect: (value: string) => void;
  locating: boolean;
  onUseLocation: () => void;
  streakReminders: boolean;
  onStreakRemindersChange: (value: boolean) => void;
  careFlagReminders: boolean;
  onCareFlagRemindersChange: (value: boolean) => void;
  safetyPledge: boolean;
  onSafetyPledgeChange: (value: boolean) => void;
  consentAccepted: boolean;
  onConsentAcceptedChange: (value: boolean) => void;
};

export function ProfileDetailsForm({
  nickname, onNicknameChange, onSuggestNickname, avatarId, onAvatarChange, spotterType, onSpotterTypeChange,
  ageGroup, onAgeChange, guardianConsent, onGuardianConsentChange, locationArea, onLocationChange, onAreaSelect,
  locating, onUseLocation, streakReminders, onStreakRemindersChange, careFlagReminders, onCareFlagRemindersChange,
  safetyPledge, onSafetyPledgeChange, consentAccepted, onConsentAcceptedChange,
}: Props) {
  const t = useTheme();
  const checkbox = (checked: boolean, label: ReactNode, onPress: () => void, accessibilityLabel: string) => (
    <Pressable accessibilityRole="checkbox" accessibilityLabel={accessibilityLabel} accessibilityState={{ checked }} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 }}>
      <View style={{ width: 22, height: 22, borderWidth: border, borderColor: checked ? t.edge : t.stone, borderRadius: 7, backgroundColor: checked ? t.amber : t.card, alignItems: 'center', justifyContent: 'center' }}>
        {checked ? <Icon name="check" size={14} color={t.onAmber} /> : null}
      </View>
      <AppText size={12.5} style={{ flex: 1, lineHeight: 18 }}>{label}</AppText>
    </Pressable>
  );

  return (
    <View style={{ width: '100%', gap: 10 }}>
      <Card>
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <AppText size={14} weight="bold">Pick a nickname</AppText>
              <AppText muted size={11.5} style={{ marginTop: 2 }}>Shown on the leaderboard and your pins. Don’t use your real name.</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Suggest a nickname" onPress={onSuggestNickname} style={{ width: 40, height: 40, borderWidth: border, borderColor: t.edge, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.amber }}>
              <AppText size={20}>🎲</AppText>
            </Pressable>
          </View>
          <TextInput value={nickname} onChangeText={onNicknameChange} placeholder="e.g. SleepyTabby42" placeholderTextColor={t.stone} autoCapitalize="none" maxLength={20} style={{ borderWidth: border, borderColor: t.edge, borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: t.card, color: t.ink, fontFamily: font.medium, fontSize: 14 }} />
          <AppText muted size={11}>3–20 characters · letters, numbers, and underscores only</AppText>
        </View>
      </Card>

      <Card>
        <AppText size={14} weight="bold">Choose your Pawprint cat</AppText>
        <AppText muted size={11.5} style={{ marginTop: 2 }}>Your avatar appears on your profile and public pins.</AppText>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          {AVATAR_OPTIONS.map((option) => {
            const selected = avatarId === option.id;
            return <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onAvatarChange(option.id)} style={{ flex: 1, alignItems: 'center', gap: 5, borderWidth: border, borderColor: selected ? t.edge : t.line, borderRadius: 14, paddingVertical: 8, backgroundColor: selected ? t.amber : t.card }}><CatAvatar variant={option.variant} avatarId={option.id} size={46} radius={14} /><AppText size={11} weight="semi" color={selected ? t.onAmber : t.ink}>{option.label}</AppText></Pressable>;
          })}
        </View>
      </Card>

      <Card>
        <AppText size={14} weight="bold">Anong klaseng spotter ka?</AppText>
        <View style={{ gap: 7, marginTop: 9 }}>
          {SPOTTER_TYPES.map((option) => {
            const selected = spotterType === option.value;
            return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onSpotterTypeChange(option.value)} style={{ borderWidth: border, borderColor: selected ? t.edge : t.line, borderRadius: 13, backgroundColor: selected ? t.amber : t.card, padding: 10 }}><AppText size={12.5} weight="semi" color={selected ? t.onAmber : t.ink}>{option.label}</AppText><AppText size={11} color={selected ? t.onAmber : t.stone} style={{ marginTop: 2 }}>{option.detail}</AppText></Pressable>;
          })}
        </View>
      </Card>

      <Card>
        <AppText size={14} weight="bold">How old are you?</AppText>
        <AppText muted size={11.5} style={{ marginTop: 2 }}>We use an age group instead of your exact birthday. This is used only for protective defaults and is not shown to others.</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
          {PROFILE_AGE_OPTIONS.map((option) => { const selected = ageGroup === option.value; return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => onAgeChange(option.value)} style={{ flexGrow: 1, minWidth: 100, borderWidth: border, borderColor: selected ? t.edge : t.line, borderRadius: radius.button, backgroundColor: selected ? t.amber : t.card, paddingHorizontal: 8, paddingVertical: 9, alignItems: 'center' }}><AppText size={11.5} weight="semi" color={selected ? t.onAmber : t.ink}>{option.label}</AppText></Pressable>; })}
        </View>
        {ageGroup === 'under_13' ? <AppText color={t.red} size={11.5} style={{ marginTop: 8 }}>Pawprint is for people aged 13 and above.</AppText> : null}
        {ageGroup === '13_17' ? <View style={{ marginTop: 8, gap: 4 }}>{checkbox(guardianConsent, 'I have permission from a parent or legal guardian to use Pawprint.', () => onGuardianConsentChange(!guardianConsent), 'Parent or guardian permission')}</View> : null}
      </Card>

      <Card>
        <AppText size={14} weight="bold">Where do you usually spot cats?</AppText>
        <AppText muted size={11.5} style={{ marginTop: 2 }}>Choose a city or area only—never enter an exact address.</AppText>
        <TextInput value={locationArea} onChangeText={onLocationChange} placeholder="Search your city or area" placeholderTextColor={t.stone} autoCapitalize="words" style={{ marginTop: 9, borderWidth: border, borderColor: t.edge, borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: t.card, color: t.ink, fontFamily: font.medium, fontSize: 14 }} />
        {!locationArea || !areaMatches(locationArea).some((area) => area.toLowerCase() === locationArea.toLowerCase()) ? <View style={{ gap: 5, marginTop: 7 }}>{areaMatches(locationArea).map((area) => <Pressable key={area} onPress={() => onAreaSelect(area)} style={{ borderWidth: 1, borderColor: t.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: t.bg }}><AppText size={12}>{area}</AppText></Pressable>)}</View> : null}
        <Button small variant="ghost" label={locating ? 'Finding your area…' : 'Use my approximate area'} onPress={onUseLocation} disabled={locating} style={{ marginTop: 8 }} />
        <AppText muted size={11} style={{ lineHeight: 16 }}>Uses device location once to suggest the area. Exact coordinates are never saved in your profile.</AppText>
      </Card>

      <Card>
        <AppText size={14} weight="bold">Your preferences</AppText>
        <View style={{ marginTop: 8, gap: 5 }}>
          {checkbox(streakReminders, 'Daily streak reminders', () => onStreakRemindersChange(!streakReminders), 'Daily streak reminders')}
          {checkbox(careFlagReminders, 'Care Flag notifications for your area', () => onCareFlagRemindersChange(!careFlagReminders), 'Care Flag notifications')}
        </View>
        <AppText muted size={11} style={{ marginTop: 3 }}>Notifications start off. You can change these choices later.</AppText>
      </Card>

      <Card>
        {checkbox(safetyPledge, 'I’ll be kind to cats: no chasing, touching, or flash.', () => onSafetyPledgeChange(!safetyPledge), 'Safety pledge')}
        {checkbox(consentAccepted, <AppText size={12.5}>I agree to the <AppText color={t.amberDeep} onPress={() => void Linking.openURL('https://pawprint-omega.vercel.app/terms')} style={{ textDecorationLine: 'underline' }}>Terms of Use</AppText> and <AppText color={t.amberDeep} onPress={() => void Linking.openURL('https://pawprint-omega.vercel.app/privacy')} style={{ textDecorationLine: 'underline' }}>Privacy Policy</AppText>.</AppText>, () => onConsentAcceptedChange(!consentAccepted), 'Terms and Privacy consent')}
      </Card>
    </View>
  );
}
