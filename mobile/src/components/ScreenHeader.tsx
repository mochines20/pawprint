import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { border, space, useTheme } from '@/theme';
import { AppText } from './AppText';
import { HardShadow } from './HardShadow';
import { Icon, IconName } from './Icon';

export function IconButton({ name, onPress, label, size = 38 }: { name: IconName; onPress?: () => void; label: string; size?: number }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}>
      <HardShadow offset={2} radius={12} color={t.shadow}>
        <View style={{ width: size, height: size, borderRadius: 12, borderWidth: border, borderColor: t.edge, backgroundColor: t.card, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={name} size={18} color={t.ink} />
        </View>
      </HardShadow>
    </Pressable>
  );
}

type Props = { title: string; left?: ReactNode; right?: ReactNode };
export function ScreenHeader({ title, left, right }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: 56 }}>
      <View style={{ width: 44, alignItems: 'flex-start' }}>{left}</View>
      <AppText size={17} weight="semi">{title}</AppText>
      <View style={{ width: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}
