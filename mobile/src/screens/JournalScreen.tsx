import { FlatList, View } from 'react-native';
import { AppText, Card, CatAvatar, Chip, Icon, ProgressBar, RarityTag, ScreenHeader, Screen } from '@/components';
import { useAsync } from '@/hooks/useAsync';
import { fetchProgress, fetchSightings } from '@/lib/api';
import { COATS, Sighting } from '@/lib/types';
import { space, useTheme } from '@/theme';

type Item = { key: string; s?: Sighting };

export function JournalScreen() {
  const t = useTheme();
  const { data } = useAsync(fetchSightings, [] as Sighting[]);
  const { data: progress } = useAsync(fetchProgress, null);
  const mine = data.filter((s) => s.mine);
  const items: Item[] = [...mine.map((s) => ({ key: s.id, s })), { key: 'locked' }];
  const coats = progress?.journal.unique ?? 0;
  const totalCoats = 3;

  const header = (
    <View style={{ gap: 10, paddingBottom: 12 }}>
      <View>
        <AppText upper size={11} muted weight="semi">Your private collection</AppText>
        <AppText size={26} weight="bold" style={{ marginTop: 2 }}>Every cat has a story.</AppText>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}><ProgressBar value={(coats / totalCoats) * 100} /></View>
        <AppText size={12} weight="semi">{coats} of {totalCoats} coats</AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip tone="ink" label="All" /><Chip label="Common" /><Chip label="Uncommon" /><Chip label="Rare" />
      </View>
    </View>
  );

  return (
    <Screen>
      <ScreenHeader title="Cat Journal" left={<Icon name="book" size={22} color={t.ink} />} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 120, gap: 12 }}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          item.s ? (
            <Card style={{ flex: 1 }} innerStyle={{ padding: 8 }}>
              <CatAvatar variant={item.s.variant} size={140} radius={16} />
              <AppText size={14} weight="semi" style={{ marginTop: 7 }}>{COATS[item.s.variant].name}</AppText>
              <View style={{ marginTop: 3, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <RarityTag rarity={COATS[item.s.variant].rarity} small />
                {item.s.seenCount > 1 && <AppText size={12} muted>×{item.s.seenCount}</AppText>}
              </View>
            </Card>
          ) : (
            <Card dashed style={{ flex: 1 }} innerStyle={{ padding: 8 }}>
              <View style={{ height: 140, borderRadius: 16, backgroundColor: t.chip, alignItems: 'center', justifyContent: 'center' }}>
                <AppText size={34} weight="bold" color={t.stone}>?</AppText>
              </View>
              <AppText size={12} weight="semi" muted style={{ marginTop: 7 }}>Not found yet</AppText>
              <AppText size={12} muted>Keep exploring</AppText>
            </Card>
          )
        }
      />
    </Screen>
  );
}
