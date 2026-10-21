import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AppText, Button, Card, CatAvatar, Chip, Icon, IconButton, ProgressBar, RarityTag } from '@/components';
import MapSurface from '@/components/MapSurface';
import { useAsync } from '@/hooks/useAsync';
import { fetchCareFlags, fetchDashboard, fetchProfile, fetchSightings } from '@/lib/api';
import type { AvatarId } from '@/lib/avatarCatalog';
import { COATS, Sighting } from '@/lib/types';
import { border, radius, space, useTheme } from '@/theme';

export function HomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const sheet = useRef<BottomSheet>(null);
  const { data: sightings } = useAsync(fetchSightings, [] as Sighting[]);
  const { data: dashboard } = useAsync(fetchDashboard, null);
  const { data: profile, reload: reloadProfile } = useAsync(fetchProfile, null);
  const { data: careFlags } = useAsync(fetchCareFlags, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saw, setSaw] = useState<Record<string, boolean>>({});
  const [centerCoordinate, setCenterCoordinate] = useState<[number, number] | null>(null);
  const snapPoints = useMemo(() => ['32%', '52%', '86%'], []);
  const selected = sightings.find((s) => s.id === selectedId) ?? null;
  const mine = sightings.filter((s) => s.mine);
  const displayName = profile?.display_name || 'Pawprint spotter';
  const streak = dashboard?.streak.current ?? 0;
  const todayCount = dashboard?.today.count ?? 0;
  const todayTarget = dashboard?.today.target ?? 1;

  useFocusEffect(useCallback(() => {
    void reloadProfile();
  }, [reloadProfile]));

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    sheet.current?.snapToIndex(id ? 1 : 0);
  }, []);

  const locate = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCenterCoordinate([pos.coords.longitude, pos.coords.latitude]);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: t.mapLand }}>
      <MapSurface
        sightings={sightings}
        selectedId={selectedId}
        onSelect={select}
        centerCoordinate={centerCoordinate}
        edge={t.edge}
      />

      {/* floating header */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={[styles.pill, { backgroundColor: t.card, borderColor: t.edge, paddingLeft: 4, paddingRight: 14 }]}>
            <CatAvatar variant="black" avatarId={profile?.avatar_url as AvatarId | undefined} size={36} radius={18} tile={t.amber} />
            <View>
              <AppText size={10} muted>Good morning</AppText>
              <AppText size={15} weight="bold">{displayName}</AppText>
            </View>
          </View>
          <View style={[styles.pill, { backgroundColor: t.card, borderColor: t.edge, paddingHorizontal: 12 }]}>
            <Icon name="flame" size={16} />
            <AppText size={13} weight="bold">{streak}</AppText>
            <AppText size={13} weight="semi">day streak</AppText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
          <Chip label="Nearby" tone="ink" />
          <Chip label="Today" />
          <Chip label={`Care flags · ${careFlags.length}`} icon={<Icon name="care" size={12} color={t.ink} />} onPress={() => nav.navigate('Main', { screen: 'Care' })} />
        </View>
      </View>
      <View style={{ position: 'absolute', right: 12, top: insets.top + 96 }}>
        <IconButton name="locate" label="Centre on my location" onPress={locate} />
      </View>

      <BottomSheet
        ref={sheet}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: t.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: 2.5, borderBottomWidth: 0, borderColor: t.edge }}
        handleIndicatorStyle={{ backgroundColor: t.line, width: 42 }}
        bottomInset={0}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
          {selected ? (
          <PinDetail s={selected} saw={!!saw[selected.id]} onSaw={() => setSaw((m) => ({ ...m, [selected.id]: true }))} onClose={() => select(null)} onCare={() => nav.navigate('CareFlag', { sightingId: selected.id })} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Card dark style={{ flex: 1 }} innerStyle={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 }}>
                  <CatAvatar variant="orange" size={54} radius={16} />
                  <View>
                    <AppText size={10.5} color="#BDBAB2">Streak</AppText>
                    <AppText size={26} weight="bold" color={t.amber} style={{ lineHeight: 28 }}>{streak}</AppText>
                    <AppText size={10.5} color="#BDBAB2">days in a row</AppText>
                  </View>
                </Card>
                <Card style={{ flex: 1 }} innerStyle={{ flex: 1 }}>
                  <AppText size={13} weight="semi">Today’s goal</AppText>
                  <AppText size={12} muted style={{ marginTop: 1, marginBottom: 8 }}>Spot 1 cat to keep it safe</AppText>
                  <ProgressBar value={(todayCount / Math.max(1, todayTarget)) * 100} />
                  <AppText size={12} weight="semi" style={{ marginTop: 5 }}>{todayCount} / {todayTarget} · +24 XP</AppText>
                </Card>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                <AppText size={15} weight="bold">Recent pawprints</AppText>
                <AppText size={12} muted onPress={() => nav.navigate('Main', { screen: 'Journal' })}>View all</AppText>
              </View>
              <View style={{ marginTop: 8, gap: 10 }}>
                {mine.map((s) => (
                  <Pressable key={s.id} onPress={() => select(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="button">
                    <CatAvatar variant={s.variant} size={44} />
                    <View style={{ flex: 1 }}>
                      <AppText size={14.5} weight="semi">{COATS[s.variant].name}</AppText>
                      <AppText size={12} muted>{s.when}</AppText>
                    </View>
                    <RarityTag rarity={COATS[s.variant].rarity} />
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}

function PinDetail({ s, saw, onSaw, onClose, onCare }: { s: Sighting; saw: boolean; onSaw: () => void; onClose: () => void; onCare: () => void }) {
  const t = useTheme();
  const coat = COATS[s.variant];
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
        <CatAvatar variant={s.variant} size={84} radius={24} />
        <View style={{ flex: 1 }}>
          <AppText size={22} weight="bold">{coat.name}</AppText>
          <AppText size={12} muted style={{ marginTop: 3 }}>Approximate public area</AppText>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <RarityTag rarity={coat.rarity} />
            <Chip label="Friendly" />
          </View>
        </View>
        <IconButton name="x" label="Close" onPress={onClose} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
        <Chip tone="cream" icon={<Icon name="clock" size={12} color={t.ink} />} label={`Expires in ${s.expiresIn}`} />
        <Chip label={`Seen ${s.seenAgo}`} />
        <Chip label={`${s.seenCount + (saw ? 1 : 0)} spotters`} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Button small variant="redLine" label="Care flag" icon={<Icon name="flag" size={18} color={t.red} />} onPress={onCare} style={{ flex: 1 }} />
        <Button small label={saw ? 'Seen' : 'I saw it too'} icon={<Icon name={saw ? 'check' : 'eye'} size={18} color={t.onAmber} />} onPress={onSaw} style={{ flex: 1.2 }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10 }}>
        <Icon name="lock" size={14} color={t.stone} />
        <AppText size={12} muted>Pin is delayed 5 min and never shows the exact spot.</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, borderRadius: 999, borderWidth: border },
});
