import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { border, radius, space, useTheme } from '@/theme';
import { HardShadow } from './HardShadow';

type Props = {
  children: ReactNode;
  dark?: boolean;
  dashed?: boolean;
  flat?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
};

export function Card({ children, dark, dashed, flat, padded = true, style, innerStyle }: Props) {
  const t = useTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: dark ? t.dark : dashed ? 'transparent' : t.card,
          borderColor: dark ? t.dark : t.edge,
          borderWidth: border,
          borderRadius: radius.card,
          borderStyle: dashed ? 'dashed' : 'solid',
          padding: padded ? space.md : 0,
          overflow: 'hidden',
        },
        innerStyle,
      ]}
    >
      {children}
    </View>
  );
  if (flat || dashed) return <View style={style}>{body}</View>;
  return (
    <HardShadow radius={radius.card} color={t.shadow} style={style}>
      {body}
    </HardShadow>
  );
}
