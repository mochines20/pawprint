import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { SvgXml } from 'react-native-svg';
import { AppText, Button, Card, CatAvatar, HardShadow, Icon, ProgressBar, Screen, ScreenHeader } from '@/components';
import { changeEmail, deleteAccount, fetchProfile, fetchProgress, updateProfile } from '@/lib/api';
import { AVATAR_CHOICES, AvatarId } from '@/lib/avatarCatalog';
import { useAsync } from '@/hooks/useAsync';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/theme';

function Medal({ earned }: { earned: boolean }) {
  return (
    <Svg width={56} height={66} viewBox="0 0 64 76" opacity={earned ? 1 : 0.4}>
      <Path d="M20 0h24l-6 26H26z" fill={earned ? '#D9402B' : '#8C8A84'} stroke="#151515" strokeWidth={2.5} strokeLinejoin="round" />
      <Circle cx={32} cy={46} r={22} fill={earned ? '#FFB400' : '#BDBAB2'} stroke="#151515" strokeWidth={3} />
      <Circle cx={32} cy={46} r={15} fill="none" stroke="#151515" strokeWidth={2} strokeDasharray="3 3" />
      <G transform="translate(32 47) scale(.95)" fill="#151515">
        <Ellipse cx={0} cy={4.5} rx={8.6} ry={7.4} />
        <Ellipse cx={-3.8} cy={-9.4} rx={3.6} ry={4.8} /><Ellipse cx={3.8} cy={-9.4} rx={3.6} ry={4.8} />
        <Ellipse cx={-10.5} cy={-3.6} rx={3.6} ry={4.6} /><Ellipse cx={10.5} cy={-3.6} rx={3.6} ry={4.6} />
      </G>
    </Svg>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1.5, borderBottomColor: t.line }}>
      <AppText size={14}>{label}</AppText>
      {children}
    </View>
  );
}

export function ProfileScreen() {
  const t = useTheme();
  const { data: profile } = useAsync(fetchProfile, null);
  const { data: progress } = useAsync(fetchProgress, null);
  const vis = ['Everyone', 'Only me'];
  const [v, setV] = useState(0);
  const [approx, setApprox] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [avatarPicker, setAvatarPicker] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarId>('cat-ink');
  const [deleting, setDeleting] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  useEffect(() => {
    if (profile?.visibility) setV(profile.visibility === 'private' ? 1 : 0);
    if (typeof profile?.approximate_map === 'boolean') setApprox(profile.approximate_map);
    if (profile?.avatar_url) setSelectedAvatar(profile.avatar_url as AvatarId);
  }, [profile?.visibility, profile?.approximate_map, profile?.avatar_url]);

  const chooseAvatar = async (avatar: AvatarId) => {
    const previous = selectedAvatar;
    setSelectedAvatar(avatar);
    try {
      await updateProfile({ avatarUrl: avatar });
    } catch (error) {
      setSelectedAvatar(previous);
      Alert.alert('Could not save avatar', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const name = profile?.display_name || 'Pawprint spotter';
  const xp = progress?.xp ?? 0;
  const nextMedal = progress?.medals.find((medal) => !medal.earned);
  const xpMax = nextMedal?.xpRequired ?? Math.max(500, xp);
  const medals = (progress?.medals ?? []).slice(0, 4);

  return (
    <Screen scroll tabBarSpace>
      <ScreenHeader title="My profile" left={<Icon name="user" size={22} color={t.ink} />} />
      <View style={{ alignItems: 'center' }}>
        <HardShadow offset={4} radius={26} color={t.shadow}><CatAvatar variant="black" avatarId={selectedAvatar} size={84} radius={26} /></HardShadow>
        <AppText size={20} weight="bold" style={{ marginTop: 12 }}>{name}’s Pawprint</AppText>
        <AppText size={12} muted style={{ textAlign: 'center' }}>Level {progress?.level ?? 1} · account details stay private</AppText>
        <Button small variant="ghost" label={avatarPicker ? 'Close avatar choices' : 'Change cat avatar'} onPress={() => setAvatarPicker((open) => !open)} style={{ marginTop: 10 }} />
      </View>
      {avatarPicker && (
        <Card style={{ marginTop: 12 }}>
          <AppText size={13} weight="semi">Choose your Pawprint cat</AppText>
          <AppText size={12} muted style={{ marginTop: 3 }}>Saved to your live profile and used across the app.</AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 8, marginTop: 12, paddingRight: 8 }}>
            {AVATAR_CHOICES.map((avatar) => {
              const active = avatar.id === selectedAvatar;
              return (
                <Pressable key={avatar.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => void chooseAvatar(avatar.id)} style={{ width: 70, alignItems: 'center', paddingVertical: 6, borderWidth: active ? 2 : 1, borderColor: active ? t.amberDeep : t.line, borderRadius: 14, backgroundColor: active ? t.cream : t.card }}>
                  <SvgXml xml={avatar.xml} width={48} height={48} />
                  <AppText size={10} weight="semi" style={{ marginTop: 3, textAlign: 'center' }}>{avatar.label}</AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </Card>
      )}

      <Card dark style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <AppText size={11} color="#BDBAB2">Total XP</AppText>
            <AppText size={28} weight="bold" color={t.amber} style={{ lineHeight: 30 }}>{xp}</AppText>
          </View>
          <AppText size={11} color="#BDBAB2">{nextMedal ? `${nextMedal.title} at ${nextMedal.xpRequired}` : 'All medals earned'}</AppText>
        </View>
        <View style={{ marginTop: 10 }}><ProgressBar value={xpMax ? (xp / xpMax) * 100 : 100} onDark /></View>
      </Card>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
        <AppText size={15} weight="bold">Medals</AppText><AppText size={12} muted>{progress?.medals.filter((medal) => medal.earned).length ?? 0} earned</AppText>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        {medals.map((m) => (
          <View key={m.id} style={{ alignItems: 'center', width: 72 }}>
            <Medal earned={m.earned} />
            <AppText size={10.5} weight="semi" style={{ marginTop: 2, textAlign: 'center' }}>{m.title}</AppText>
          </View>
        ))}
      </View>

      <AppText size={15} weight="bold" style={{ marginTop: 16 }}>Privacy controls</AppText>
      <Row label="Public visibility">
        <Pressable accessibilityRole="button" onPress={() => {
          const next = (v + 1) % 2;
          setV(next);
          void updateProfile({ visibility: ['public', 'private'][next] }).catch(() => undefined);
        }} style={{ borderWidth: 1.5, borderColor: t.edge, borderRadius: radius.chip, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: t.card }}>
          <AppText size={13} weight="semi">{vis[v]} ›</AppText>
        </Pressable>
      </Row>
      <Row label="Approximate map only">
        <Switch value={approx} onValueChange={(value) => { setApprox(value); void updateProfile({ approximate_map: value }).catch(() => undefined); }} trackColor={{ true: t.amber, false: t.line }} thumbColor="#fff" />
      </Row>
      <Row label="Delay pins by 5 minutes"><AppText size={13} weight="semi">Always on</AppText></Row>

      <Row label="Email address">
        <Pressable accessibilityRole="button" onPress={() => setEmailModal(true)}><AppText size={13} weight="semi" color={t.ink}>Change ›</AppText></Pressable>
      </Row>

      <View style={{ paddingVertical: 11 }}>
        {confirm ? (
          <Card>
            <AppText size={14} weight="semi">Delete all your pawprints and account data?</AppText>
            <AppText size={12} muted style={{ marginTop: 4, marginBottom: 10 }}>Photos and sightings are removed permanently, including files in storage.</AppText>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button small variant="ghost" label="Keep my data" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
              <Button small variant="red" label={deleting ? 'Deleting…' : 'Delete'} disabled={deleting} onPress={() => {
                setDeleting(true);
                void deleteAccount().then(async () => { await supabase.auth.signOut({ scope: 'local' }); }).catch((error) => Alert.alert('Could not delete account', error instanceof Error ? error.message : 'Please try again.')).finally(() => { setDeleting(false); setConfirm(false); });
              }} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => setConfirm(true)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText size={14}>Export or delete my data</AppText><AppText weight="bold">›</AppText>
          </Pressable>
        )}
      </View>
      {isSupabaseConfigured && <Button variant="ghost" small label="Sign out" onPress={() => supabase.auth.signOut()} style={{ marginTop: space.sm }} />}
      <Modal visible={emailModal} transparent animationType="slide" onRequestClose={() => setEmailModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <Card style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: space.lg }}>
            <AppText size={20} weight="bold">Change email</AppText>
            <AppText size={12} muted style={{ marginTop: 4 }}>Supabase will send a confirmation link to the new address.</AppText>
            <TextInput value={newEmail} onChangeText={setNewEmail} autoCapitalize="none" keyboardType="email-address" placeholder="New email address" placeholderTextColor={t.stone} style={{ marginTop: 14, borderWidth: 1.5, borderColor: t.edge, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, color: t.ink, backgroundColor: t.bg }} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button small variant="ghost" label="Cancel" onPress={() => setEmailModal(false)} style={{ flex: 1 }} />
              <Button small label={emailBusy ? 'Saving…' : 'Send confirmation'} disabled={emailBusy || !newEmail.includes('@')} onPress={() => {
                setEmailBusy(true);
                void changeEmail(newEmail).then(() => { Alert.alert('Check your email', 'Confirm the change from the new address.'); setEmailModal(false); setNewEmail(''); }).catch((error) => Alert.alert('Could not change email', error instanceof Error ? error.message : 'Please try again.')).finally(() => setEmailBusy(false));
              }} style={{ flex: 1 }} />
            </View>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}
