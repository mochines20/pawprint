import { ReactNode, useState } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { border, radius, space, useTheme } from '@/theme';
import { AppText } from './AppText';

type Variant = 'primary' | 'ghost' | 'red' | 'redLine';
type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: ReactNode;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', icon, small, disabled, style }: Props) {
  const t = useTheme();
  const [down, setDown] = useState(false);
  const palette = {
    primary: { bg: t.amber, fg: t.onAmber, edge: t.edge, shadow: t.shadow },
    ghost: { bg: t.card, fg: t.ink, edge: t.edge, shadow: t.shadow },
    red: { bg: t.red, fg: '#FFFFFF', edge: t.edge, shadow: t.shadow },
    redLine: { bg: t.card, fg: t.red, edge: t.red, shadow: t.red },
  }[variant];
  const off = down ? 1 : 3;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress?.(); }}
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
    >
      <View style={{ paddingRight: 3, paddingBottom: 3 }}>
        <View style={{ position: 'absolute', left: 3, top: 3, right: 0, bottom: 0, borderRadius: radius.button, backgroundColor: palette.shadow }} />
        <View
          style={{
            transform: [{ translateX: 3 - off }, { translateY: 3 - off }],
            minHeight: small ? 46 : 52,
            borderRadius: radius.button,
            borderWidth: border,
            borderColor: palette.edge,
            backgroundColor: palette.bg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.sm,
            paddingHorizontal: space.lg,
          }}
        >
          {icon}
          <AppText weight="bold" size={small ? 15 : 17} color={palette.fg}>{label}</AppText>
        </View>
      </View>
    </Pressable>
  );
}
