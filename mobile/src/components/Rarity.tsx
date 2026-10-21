import { View } from 'react-native';
import { radius, useTheme } from '@/theme';
import type { Rarity as R } from '@/lib/types';
import { AppText } from './AppText';

export function RarityTag({ rarity, small }: { rarity: R; small?: boolean }) {
  const t = useTheme();
  const bg = rarity === 'rare' ? t.amber : rarity === 'uncommon' ? '#D9F0DC' : t.chip;
  const fg = rarity === 'common' ? t.ink : '#151515';
  return (
    <View style={{ borderRadius: radius.chip, borderWidth: 1.5, borderColor: t.edge, backgroundColor: bg, paddingHorizontal: small ? 8 : 10, paddingVertical: small ? 1 : 3, alignSelf: 'flex-start' }}>
      <AppText size={small ? 10 : 11} weight="bold" color={fg}>{rarity}</AppText>
    </View>
  );
}
