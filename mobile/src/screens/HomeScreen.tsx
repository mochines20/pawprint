import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AppText, Button, Card, CatAvatar, Chip, Icon, IconButton, ProgressBar, RarityTag } from '@/components';
import MapSurface, { type MapStatus } from '@/components/MapSurface';
import { useAsync } from '@/hooks/useAsync';
import { blockContent, fetchCareFlags, fetchDashboard, fetchProfile, fetchSightings, markSightingSeen, reportContent } from '@/lib/api';
import type { AvatarId } from '@/lib/avatarCatalog';
import { COATS, Sighting } from '@/lib/types';
import { border, radius, space, useTheme } from '@/theme';

function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), milliseconds);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function HomeScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const { width: windowWidth } = useWindowDimensions();
  const sheet = useRef<BottomSheet>(null);
  const { data: sightings, loading: sightingsLoading, error: sightingsError, reload: reloadSightings } = useAsync(fetchSightings, [] as Sighting[]);
  const { data: dashboard, reload: reloadDashboard } = useAsync(fetchDashboard, null);
  const { data: profile, reload: reloadProfile } = useAsync(fetchProfile, null);
  const { data: careFlags, reload: reloadCareFlags } = useAsync(fetchCareFlags, []);
  const qaMockPin = useMemo<Sighting | null>(() => {
    // QA-only map rendering check. It is intentionally gated out of production
    // builds and never calls the API or writes a database row.
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return null;
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return null;
    if (new URLSearchParams(window.location.search).get('qaPin') !== '1') return null;
    return {
      id: 'qa-local-preview-pin',
      variant: 'orange',
      lat: 14.4088,
      lng: 121.0415,
      when: 'QA preview',
      mine: false,
      seenCount: 0,
      expiresIn: 'QA only',
      seenAgo: 'now',
      catBreed: 'QA preview cat',
      description: 'Local QA preview only. Not saved or visible to other users.',
    };
  }, []);
  const mapSightings = useMemo(() => qaMockPin && !sightingsError ? [...sightings, qaMockPin] : sightings, [qaMockPin, sightings, sightingsError]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saw, setSaw] = useState<Record<string, boolean>>({});
  const [centerCoordinate, setCenterCoordinate] = useState<[number, number] | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading');
  const [mapRetryKey, setMapRetryKey] = useState(0);
  const [locating, setLocating] = useState(false);
  const [timeGreeting, setTimeGreeting] = useState(() => getTimeGreeting());
  const snapPoints = useMemo(() => ['32%', '52%', '86%'], []);
  const selected = mapSightings.find((s) => s.id === selectedId) ?? null;
  const mine = mapSightings.filter((s) => s.mine);
  const displayName = profile?.display_name || 'Pawprint spotter';
  const streak = dashboard?.streak.current ?? 0;
  const todayCount = dashboard?.today.count ?? 0;
  const todayTarget = dashboard?.today.target ?? 1;
  const compactHeader = windowWidth < 390;

  useEffect(() => {
    const refreshGreeting = () => setTimeGreeting(getTimeGreeting());
    const timer = setInterval(refreshGreeting, 60_000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(useCallback(() => {
    void reloadProfile();
    void reloadSightings();
    void reloadDashboard();
    void reloadCareFlags();
  }, [reloadCareFlags, reloadDashboard, reloadProfile, reloadSightings]));

  const select = useCallback((id: string | null) => {
    setSelectedId(id);
    sheet.current?.snapToIndex(id ? 1 : 0);
  }, []);

  const markSeen = useCallback(async (id: string) => {
    if (saw[id]) return;
    setSaw((m) => ({ ...m, [id]: true }));
    try {
      await markSightingSeen(id);
    } catch (error) {
      setSaw((m) => ({ ...m, [id]: false }));
      Alert.alert('Could not save that', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [saw]);

  const locate = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const { status } = await withTimeout(Location.requestForegroundPermissionsAsync(), 6000);
      if (status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access to centre the map on your area. Public cat pins remain approximate.');
        return;
      }
      const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 8000);
      setCenterCoordinate([pos.coords.longitude, pos.coords.latitude]);
    } catch {
      Alert.alert('Could not find your location', 'Check your device location settings and try again.');
    } finally {
      setLocating(false);
    }
  }, [locating]);

  const retryMap = useCallback(() => {
    setMapStatus('loading');
    setMapRetryKey((value) => value + 1);
    void reloadSightings();
  }, [reloadSightings]);

  return (
    <View style={{ flex: 1, backgroundColor: t.mapLand }}>
      <MapSurface
        key={mapRetryKey}
        sightings={mapSightings}
        selectedId={selectedId}
        onSelect={select}
        centerCoordinate={centerCoordinate}
        edge={t.edge}
        onStatusChange={setMapStatus}
      />

      {/* floating header */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 8, right: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={[styles.pill, { backgroundColor: t.card, borderColor: t.edge, paddingLeft: 4, paddingRight: compactHeader ? 6 : 10, gap: compactHeader ? 5 : 8, flex: 1, minWidth: 0, maxWidth: compactHeader ? '52%' : '64%' }]}>
            <CatAvatar variant="black" avatarId={profile?.avatar_url as AvatarId | undefined} size={compactHeader ? 32 : 36} radius={compactHeader ? 16 : 18} tile={t.amber} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText size={10} muted numberOfLines={1}>{compactHeader ? 'Hi' : timeGreeting}</AppText>
              <AppText size={15} weight="bold" numberOfLines={1} ellipsizeMode="tail">{displayName}</AppText>
            </View>
          </View>
          <View style={[styles.pill, { backgroundColor: t.card, borderColor: t.edge, paddingHorizontal: compactHeader ? 6 : 10, gap: compactHeader ? 5 : 8, flexShrink: 0, width: compactHeader ? 136 : undefined, maxWidth: compactHeader ? '46%' : '36%' }]}>
            <Icon name="flame" size={compactHeader ? 14 : 16} />
            <AppText size={compactHeader ? 11 : 12} weight="bold" numberOfLines={1}>{streak}</AppText>
            <AppText size={compactHeader ? 11 : 12} weight="semi" numberOfLines={1}>day streak</AppText>
          </View>
        </View>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={{ marginTop: 8 }}
        >
          <Chip label="Nearby" tone="ink" />
          <Chip label="Today" />
          <Chip label={`Care flags · ${careFlags.length}`} icon={<Icon name="care" size={12} color={t.ink} />} onPress={() => nav.navigate('Main', { screen: 'Care' })} />
        </ScrollView>
      </View>
      <View style={{ position: 'absolute', right: 10, top: insets.top + (compactHeader ? 104 : 108) }}>
        <IconButton name="locate" label="Centre on my location" onPress={locate} />
      </View>

      {(mapStatus === 'error' || sightingsError) && (
        <View style={[styles.mapNotice, { top: insets.top + 148, backgroundColor: t.card, borderColor: t.edge }]}>
          <Icon name="locate" size={18} color={t.red} />
          <View style={{ flex: 1 }}>
            <AppText size={13} weight="semi">Map needs a retry</AppText>
            <AppText size={11} muted>We could not load the live map or cat pins.</AppText>
          </View>
          <Button small label="Retry" onPress={retryMap} />
        </View>
      )}

      {qaMockPin && !sightingsError && (
        <View style={[styles.qaNotice, { top: insets.top + 148, backgroundColor: t.card, borderColor: t.amber }]}>
          <Icon name="eye" size={16} color={t.amberDeep} />
          <AppText size={11} weight="semi">QA preview pin · local only · not saved</AppText>
        </View>
      )}

      {!sightingsLoading && !sightingsError && mapSightings.length === 0 && mapStatus === 'ready' && (
        <View style={[styles.mapNotice, { top: insets.top + 148, backgroundColor: t.card, borderColor: t.edge }]}>
          <Icon name="eye" size={18} color={t.amberDeep} />
          <View style={{ flex: 1 }}>
            <AppText size={13} weight="semi">No live cat pins yet</AppText>
            <AppText size={11} muted>Approved, delayed sightings will appear here.</AppText>
          </View>
        </View>
      )}

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
          <PinDetail s={selected} saw={!!saw[selected.id]} onSaw={() => void markSeen(selected.id)} onClose={() => select(null)} onCare={() => nav.navigate('CareFlag', { sightingId: selected.id })} />
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
                {mine.length ? mine.map((s) => (
                  <Pressable key={s.id} onPress={() => select(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityRole="button">
                    <CatAvatar variant={s.variant} size={44} />
                    <View style={{ flex: 1 }}>
                      <AppText size={14.5} weight="semi">{COATS[s.variant].name}</AppText>
                      <AppText size={12} muted>{s.when}</AppText>
                    </View>
                    <RarityTag rarity={COATS[s.variant].rarity} />
                  </Pressable>
                )) : <AppText size={12} muted>No saved pawprints yet. Spot a cat to start your Journal.</AppText>}
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
      {!s.mine && <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
        <Pressable accessibilityRole="button" onPress={() => Alert.alert('Report this pawprint?', 'Choose Report if the photo, nickname, or Care information is unsafe or inappropriate.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Report', style: 'destructive', onPress: () => { void reportContent('sighting', s.id, 'unsafe_or_inappropriate').then(() => Alert.alert('Report sent', 'Thanks. Pawprint will review it.')).catch(() => Alert.alert('Could not send report', 'Please try again.')); } },
        ])}>
          <AppText size={12} muted style={{ textDecorationLine: 'underline' }}>Report pin</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => Alert.alert('Block this spotter?', 'Their public pins will no longer appear on your map.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Block', style: 'destructive', onPress: () => { void blockContent('sighting', s.id).then(() => Alert.alert('Spotter blocked', 'Their future public pins will be hidden.')).catch(() => Alert.alert('Could not block spotter', 'Please try again.')); } },
        ])}>
          <AppText size={12} muted style={{ textDecorationLine: 'underline' }}>Block spotter</AppText>
        </Pressable>
      </View>}
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10 }}>
        <Icon name="lock" size={14} color={t.stone} />
        <AppText size={12} muted>Pin is delayed 5 min and never shows the exact spot.</AppText>
      </View>
      {s.emergency && (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 10 }}>
          <Icon name="flag" size={14} color={t.red} />
          <AppText size={12} color={t.red} weight="semi">Care flag reported for this cat.</AppText>
        </View>
      )}
      {s.catBreed && <AppText size={12} muted style={{ marginTop: 8 }}>Detected as {s.catBreed}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, borderRadius: 999, borderWidth: border },
  filterRow: { flexDirection: 'row', gap: 6, paddingRight: 8 },
  mapNotice: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: border, borderRadius: 16, shadowColor: '#151515', shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
  qaNotice: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 9, borderWidth: border, borderRadius: 14 },
});
