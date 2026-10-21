import { ReactNode } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { radius, useTheme } from '@/theme';
import { AppText } from './AppText';

type Tone = 'default' | 'ink' | 'cream' | 'amber' | 'red' | 'dark';
type Props = { label: string; tone?: Tone; icon?: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> };

export function Chip({ label, tone = 'default', icon, onPress, style }: Props) {
  const t = useTheme();
  const map = {
    default: { bg: t.card, fg: t.ink, edge: t.edge },
    ink: { bg: t.ink, fg: t.bg, edge: t.edge },
    cream: { bg: t.cream, fg: t.ink, edge: t.edge },
    amber: { bg: t.amber, fg: t.onAmber, edge: t.edge },
    red: { bg: t.red, fg: '#FFFFFF', edge: t.edge },
    dark: { bg: '#151515', fg: '#FFFFFF', edge: '#FFFFFF' },
  }[tone];
  const body = (
    <View
      style={[
        {
          flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
          paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.chip,
          borderWidth: 1.5, borderColor: map.edge, backgroundColor: map.bg,
        },
        style,
      ]}
    >
      {icon}
      <AppText size={12} weight="semi" color={map.fg}>{label}</AppText>
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress}>{body}</Pressable> : body;
}
