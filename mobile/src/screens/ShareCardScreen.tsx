import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Alert, Pressable, ScrollView, Switch, useWindowDimensions, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { AppText, Button, Icon } from '@/components';
import { CARD_W, ShareCard, cardHeight, resolveTheme, type CardRef, type ShareFormat, type ShareTemplate, type ShareTheme } from '@/components/ShareCard';
import { fetchProfile, fetchProgress } from '@/lib/api';
import { useAsync } from '@/hooks/useAsync';
import { buildCaption, copyCaption, saveCard, shareCard } from '@/lib/share';
import type { RootStackParamList } from '@/navigation/types';
import { border, radius, space, useTheme } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ShareCard'>;

const TEMPLATES: { key: ShareTemplate; label: string }[] = [
  { key: 'sighting', label: 'Sighting' },
  { key: 'streak', label: 'Streak' },
  { key: 'journal', label: 'Journal' },
];
const THEMES: { key: ShareTheme; label: string }[] = [
  { key: 'auto', label: 'Auto' }, { key: 'paper', label: 'Paper' }, { key: 'amber', label: 'Amber' }, { key: 'ink', label: 'Ink' },
];
const SWATCH: Record<ShareTheme, string> = { auto: '#FFB400', paper: '#FAF8F4', amber: '#FFB400', ink: '#151515' };

export function ShareCardScreen({ navigation, route }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { data: profile } = useAsync(fetchProfile, null);
  const { data: progress } = useAsync(fetchProgress, null);
  const p = {
    name: profile?.display_name || 'Pawprint spotter',
    streak: progress?.streak.current ?? 0,
    coats: progress?.journal.unique ?? 0,
    totalCoats: 3,
    tier: `Level ${progress?.level ?? 1}`,
  };
  const { variant, xp, isNewCoat, photoUri, area, template: initial } = route.params;

  const [index, setIndex] = useState(Math.max(0, TEMPLATES.findIndex((x) => x.key === (initial ?? 'sighting'))));
  const [format, setFormat] = useState<ShareFormat>('story');
  const [theme, setTheme] = useState<ShareTheme>('auto');
  const [usePhoto, setUsePhoto] = useState(false); // OFF by default: photos can reveal surroundings
  const [busy, setBusy] = useState<null | 'share' | 'save'>(null);
  const [toast, setToast] = useState<string | null>(null);

  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const r0 = useRef<CardRef>(null); const r1 = useRef<CardRef>(null); const r2 = useRef<CardRef>(null);
  const refs = [r0, r1, r2];
  const template = TEMPLATES[index].key;

  const h = cardHeight(format);
  const scale = Math.min((screenW - 56) / CARD_W, 430 / h);
  const pageH = h * scale + 12;

  useEffect(() => { scroller.current?.scrollTo({ x: index * screenW, animated: false }); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2200); return () => clearTimeout(id); }, [toast]);

  const common = useMemo(() => ({
    format, theme,
    nickname: p.name,            // TODO: use the saved nickname
    variant, area: area ?? profile?.location_area ?? 'Muntinlupa', whenLabel: 'Today',
    xp, isNewCoat, coatNo: 7,    // TODO: real coat number from the Journal
    streak: p.streak, week: [true, true, true, true, false, false, false],
    coats: p.coats, totalCoats: p.totalCoats, found: ['orange', 'calico', 'black'] as ('orange' | 'calico' | 'black')[],
    tier: p.tier,
    photoUri: usePhoto ? photoUri : undefined,
  }), [format, theme, p, variant, area, xp, isNewCoat, usePhoto, photoUri]);

  const goTo = (i: number) => { setIndex(i); scroller.current?.scrollTo({ x: i * screenW, animated: true }); Haptics.selectionAsync(); };

  const run = async (kind: 'share' | 'save') => {
    try {
      setBusy(kind);
      const ref = refs[index];
      if (kind === 'share') await shareCard(ref, format);
      else setToast((await saveCard(ref, format)) ? 'Saved to your photos ✓' : 'Allow photo access to save');
    } catch (e) {
      Alert.alert('Could not ' + kind, e instanceof Error ? e.message : 'Please try again.');
    } finally { setBusy(null); }
  };

  const onCopy = async () => {
    await copyCaption(buildCaption(template, { variant, xp, streak: p.streak, coats: p.coats, totalCoats: p.totalCoats, area: area ?? profile?.location_area ?? 'Muntinlupa' }));
    setToast('Caption copied ✓');
  };

  const Seg = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress}
      style={{ flex: 1, paddingVertical: 8, borderRadius: radius.chip, backgroundColor: active ? t.ink : 'transparent', alignItems: 'center' }}>
      <AppText size={13} weight="bold" color={active ? t.bg : t.ink}>{label}</AppText>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
        <View>
          <AppText size={20} weight="bold">Share your pawprint</AppText>
          <AppText size={12} muted>Swipe to pick a card</AppText>
        </View>
        <Pressable accessibilityLabel="Close" onPress={() => navigation.goBack()} hitSlop={12}
          style={{ width: 38, height: 38, borderRadius: 19, borderWidth: border, borderColor: t.edge, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={16} color={t.ink} />
        </Pressable>
      </View>

      {/* swipeable previews: all 3 stay mounted so each has its own capture ref */}
      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginTop: 14 }}
        onMomentumScrollEnd={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / screenW); if (i !== index) { setIndex(i); Haptics.selectionAsync(); } }}>
        {TEMPLATES.map((x, i) => (
          <View key={x.key} style={{ width: screenW, height: pageH, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: CARD_W * scale, height: h * scale, borderRadius: 16 * scale, overflow: 'hidden', borderWidth: 2, borderColor: t.edge, backgroundColor: resolveTheme(x.key, theme).bg }}>
              <View style={{ width: CARD_W, height: h, transform: [{ scale }], transformOrigin: 'top left' }}>
                <ShareCard ref={refs[i]} template={x.key} {...common} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* dots + labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 6 }}>
        {TEMPLATES.map((x, i) => (
          <Pressable key={x.key} onPress={() => goTo(i)} hitSlop={8} style={{ alignItems: 'center', gap: 4 }}>
            <AppText size={12} weight={i === index ? 'bold' : 'medium'} color={i === index ? t.ink : t.stone}>{x.label}</AppText>
            <View style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? t.amber : t.line, borderWidth: i === index ? 1.5 : 0, borderColor: t.edge }} />
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: 14, paddingBottom: 150, gap: 14 }}>
        {/* format segmented control */}
        <View style={{ flexDirection: 'row', backgroundColor: t.chip, borderRadius: radius.chip, padding: 3 }}>
          <Seg active={format === 'story'} label="Story 9:16" onPress={() => setFormat('story')} />
          <Seg active={format === 'square'} label="Square 1:1" onPress={() => setFormat('square')} />
        </View>

        {/* colour */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <AppText size={13} weight="semi">Colour</AppText>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {THEMES.map((x) => (
              <Pressable key={x.key} accessibilityLabel={`${x.label} colour`} onPress={() => { setTheme(x.key); Haptics.selectionAsync(); }} hitSlop={6} style={{ alignItems: 'center', gap: 3 }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: SWATCH[x.key], borderWidth: theme === x.key ? 3 : 2, borderColor: t.edge, alignItems: 'center', justifyContent: 'center' }}>
                  {x.key === 'auto' ? <AppText size={10} weight="bold" color="#151515">A</AppText> : null}
                </View>
                <AppText size={10} color={theme === x.key ? t.ink : t.stone} weight={theme === x.key ? 'bold' : 'medium'}>{x.label}</AppText>
              </Pressable>
            ))}
          </View>
        </View>

        {photoUri && template === 'sighting' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Switch value={usePhoto} onValueChange={setUsePhoto} trackColor={{ true: t.amber }} />
            <View style={{ flex: 1 }}>
              <AppText size={13} weight="semi">Use my photo</AppText>
              <AppText size={11} muted>Photos can show street signs or houses. Off = cat avatar.</AppText>
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="lock" size={13} color={t.stone} />
          <AppText size={12} muted>Only your nickname and an approximate area are shown.</AppText>
        </View>
      </ScrollView>

      {/* sticky actions */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line, gap: 10 }}>
        {toast ? (
          <View style={{ position: 'absolute', top: -44, alignSelf: 'center', backgroundColor: t.ink, borderRadius: radius.chip, paddingHorizontal: 14, paddingVertical: 8 }}>
            <AppText size={13} weight="bold" color={t.bg}>{toast}</AppText>
          </View>
        ) : null}
        <Button label={busy === 'share' ? 'Preparing…' : 'Share'} onPress={() => run('share')} disabled={busy !== null} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button style={{ flex: 1 }} variant="ghost" small label={busy === 'save' ? 'Saving…' : 'Save image'} onPress={() => run('save')} disabled={busy !== null} />
          <Button style={{ flex: 1 }} variant="ghost" small label="Copy caption" onPress={onCopy} />
        </View>
      </View>
    </View>
  );
}
