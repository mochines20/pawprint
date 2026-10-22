import { Alert, FlatList, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppText, Button, Card, CatAvatar, Chip, Icon, Screen, ScreenHeader } from '@/components';
import { useAsync } from '@/hooks/useAsync';
import { blockContent, createRescueRequest, fetchCareFlags, reportContent } from '@/lib/api';
import type { CareFlag } from '@/lib/types';
import { space, useTheme } from '@/theme';
import { useState } from 'react';

export function CareScreen() {
  const t = useTheme();
  const nav = useNavigation();
  const { data } = useAsync(fetchCareFlags, [] as CareFlag[]);
  const [helping, setHelping] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});

  const offerHelp = async (item: CareFlag) => {
    if (helping[item.id] || sending[item.id]) return;
    setSending((m) => ({ ...m, [item.id]: true }));
    try {
      await createRescueRequest(item.sightingId, item.need, item.note);
      setHelping((m) => ({ ...m, [item.id]: true }));
    } catch (error) {
      Alert.alert('Could not send help request', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSending((m) => ({ ...m, [item.id]: false }));
    }
  };

  const header = (
    <View style={{ paddingBottom: 14 }}>
      <AppText size={26} weight="bold">Your care flags</AppText>
      <AppText size={12} muted style={{ marginTop: 6 }}>Live reports linked to your pawprints. Areas are approximate.</AppText>
      <Button variant="red" label="Raise a Care Flag" icon={<Icon name="flag" size={18} color="#fff" />} onPress={() => Alert.alert('Choose a pawprint first', 'Open Home, tap a live pawprint, then choose Care flag so the report is linked to the correct sighting.')} style={{ marginTop: 14 }} />
    </View>
  );

  return (
    <Screen>
      <ScreenHeader title="Care" left={<Icon name="care" size={22} color={t.ink} />} />
      <FlatList
        data={data}
        keyExtractor={(f) => f.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120, gap: 12 }}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <CatAvatar variant={item.variant} size={56} radius={16} />
              <View style={{ flex: 1 }}>
                <Chip tone="red" label={item.need} />
                <AppText size={14} weight="semi" style={{ marginTop: 6 }}>{item.note}</AppText>
                <AppText size={12} muted style={{ marginTop: 2 }}>{item.where}</AppText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 }}>
              <Button
                small
                variant={helping[item.id] ? 'ghost' : 'primary'}
                label={sending[item.id] ? 'Sending…' : helping[item.id] ? 'You’re on your way' : 'I can help'}
                icon={helping[item.id] ? <Icon name="check" size={16} color={t.ink} /> : undefined}
                onPress={() => void offerHelp(item)}
                style={{ flex: 1 }}
              />
              <Pressable accessibilityRole="button" onPress={() => Alert.alert('Report this Care Flag?', 'Report inaccurate, unsafe, or inappropriate information.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Report', style: 'destructive', onPress: () => { void reportContent('care_flag', item.id, 'unsafe_or_inappropriate').then(() => Alert.alert('Report sent', 'Thanks. Pawprint will review it.')).catch(() => Alert.alert('Could not send report', 'Please try again.')); } },
              ])}><AppText size={12} muted style={{ textDecorationLine: 'underline' }}>Report</AppText></Pressable>
              <Pressable accessibilityRole="button" onPress={() => Alert.alert('Block this spotter?', 'Their future public pins will no longer appear on your map.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Block', style: 'destructive', onPress: () => { void blockContent('care_flag', item.id).then(() => Alert.alert('Spotter blocked', 'Their future public pins will be hidden.')).catch(() => Alert.alert('Could not block spotter', 'Please try again.')); } },
              ])}><AppText size={12} muted style={{ textDecorationLine: 'underline' }}>Block</AppText></Pressable>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}
