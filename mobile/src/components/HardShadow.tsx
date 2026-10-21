import { ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

type Props = { offset?: number; radius: number; color: string; style?: StyleProp<ViewStyle>; children: ReactNode };

/**
 * Neo-brutalist hard shadow. RN shadows blur and differ per platform,
 * so we draw an offset solid layer behind the content instead.
 */
export function HardShadow({ offset = 3, radius, color, style, children }: Props) {
  return (
    <View style={[{ paddingRight: offset, paddingBottom: offset }, style]}>
      <View style={{ position: 'absolute', left: offset, top: offset, right: 0, bottom: 0, borderRadius: radius, backgroundColor: color }} />
      {children}
    </View>
  );
}
