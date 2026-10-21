import { Text, TextProps, TextStyle } from 'react-native';
import { font, useTheme } from '@/theme';

type Props = TextProps & {
  size?: number;
  weight?: keyof typeof font;
  color?: string;
  muted?: boolean;
  upper?: boolean;
};

export function AppText({ size = 14, weight = 'medium', color, muted, upper, style, ...rest }: Props) {
  const t = useTheme();
  const base: TextStyle = {
    fontFamily: font[weight],
    fontSize: size,
    color: color ?? (muted ? t.stone : t.ink),
    ...(upper ? { textTransform: 'uppercase', letterSpacing: size * 0.12 } : null),
  };
  return <Text {...rest} style={[base, style]} />;
}
