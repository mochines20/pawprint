import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, CatAvatar, Chip, Card, Icon, IconButton, PinMarker } from '@/components';
import { raiseCareFlag } from '@/lib/api';
import type { CareNeed } from '@/lib/types';
import type { RootStackParamList } from '@/navigation/types';
import { border, font, radius, space, useTheme } from '@/theme';

const NativeMaps: any = Platform.OS === 'web' ? null : require('react-native-maps');

const NEEDS: CareNeed[] = ['Water', 'Food', 'Injured', 'Kittens alone', 'Stuck / unsafe', 'Other'];
// Viewport only; the server does not receive or publish an exact location from this form.
const FLAG_VIEWPORT = { latitude: 14.5995, longitude: 120.9842, latitudeDelta: 3.8, longitudeDelta: 3.8 };
type Props = NativeStackScreenProps<RootStackParamList, 'CareFlag'>;

export function CareFlagScreen({ navigation, route }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [need, setNeed] = useState<CareNeed>(route.params?.presetNeed ?? 'Water');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!route.params?.sightingId) {
      Alert.alert('Choose a pawprint first', 'This report needs to be linked to a live sighting.');
      return;
    }
    setSending(true);
    try { await raiseCareFlag(route.params.sightingId, need, note.trim()); navigation.goBack(); }
    catch (error) { Alert.alert('Could not send care flag', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setSending(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: 14, paddingBottom: 8 }}>
        <IconButton name="back" label="Back" onPress={() => navigation.goBack()} />
        <AppText size={17} weight="semi">Raise a Care Flag</AppText>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <AppText upper size={11} muted weight="semi">What does the cat need?</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {NEEDS.map((n) => {
            const on = n === need;
            return (
              <Pressable key={n} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setNeed(n)}
                style={{ flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.chip, borderWidth: 1.5, borderColor: t.edge, backgroundColor: on ? t.red : t.card }}>
                {on && <Icon name="check" size={14} color="#fff" />}
                <AppText size={13} weight="semi" color={on ? '#fff' : t.ink}>{n}</AppText>
              </Pressable>
            );
          })}
        </View>

        <AppText upper size={11} muted weight="semi" style={{ marginTop: 16 }}>Photo</AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <CatAvatar variant="orange" size={64} radius={18} />
          <View style={{ width: 64, height: 64, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: t.stone, alignItems: 'center', justifyContent: 'center' }}>
            <AppText size={26} muted>+</AppText>
          </View>
          <AppText size={12} muted style={{ flex: 1 }}>Camera only. Faces and plates are blurred automatically.</AppText>
        </View>

        <AppText upper size={11} muted weight="semi" style={{ marginTop: 16 }}>Note (optional)</AppText>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Near the corner store, looks thirsty…"
          placeholderTextColor={t.stone}
          style={{ marginTop: 8, minHeight: 64, borderWidth: border, borderColor: t.edge, borderRadius: 14, padding: 12, backgroundColor: t.card, color: t.ink, fontFamily: font.medium, fontSize: 14, textAlignVertical: 'top' }}
        />

        <Card padded={false} style={{ marginTop: 14 }}>
          <View style={{ height: 140 }}>
            {Platform.OS === 'web' ? (
              <View style={{ flex: 1, backgroundColor: '#2B2C31', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 110, height: 110, borderRadius: 60, borderWidth: 2, borderStyle: 'dashed', borderColor: t.red, backgroundColor: 'rgba(217,64,43,0.16)', alignItems: 'center', justifyContent: 'center' }}>
                  <PinMarker fill={t.red} />
                </View>
              </View>
            ) : (
              <NativeMaps.MapView style={{ flex: 1 }} initialRegion={FLAG_VIEWPORT} scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false} toolbarEnabled={false} pointerEvents="none">
                <NativeMaps.Circle center={FLAG_VIEWPORT} radius={150} fillColor="rgba(217,64,43,0.16)" strokeColor={t.red} strokeWidth={2} lineDashPattern={[4, 4]} />
                <NativeMaps.Marker coordinate={FLAG_VIEWPORT} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={false}><PinMarker fill={t.red} /></NativeMaps.Marker>
              </NativeMaps.MapView>
            )}
            <View style={{ position: 'absolute', left: 10, bottom: 10 }}><Chip tone="cream" label="Approximate area · not exact" /></View>
          </View>
        </Card>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
          <Icon name="lock" size={14} color={t.stone} />
          <AppText size={12} muted style={{ flex: 1 }}>Shared only with nearby volunteers and trusted rescue partners.</AppText>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + 12 }}>
        <Button variant="red" label={sending ? 'Sending…' : 'Send Care Flag'} icon={<Icon name="flag" size={18} color="#fff" />} onPress={send} disabled={sending || !route.params?.sightingId} />
        <AppText size={12} muted style={{ textAlign: 'center', marginTop: 8 }}>Not an emergency service. For urgent injuries, contact a local vet.</AppText>
      </View>
    </KeyboardAvoidingView>
  );
}
