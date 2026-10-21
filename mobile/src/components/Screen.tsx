import { ReactNode } from 'react';
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '@/theme';

type Props = { children: ReactNode; scroll?: boolean; tabBarSpace?: boolean; style?: StyleProp<ViewStyle>; edges?: ('top' | 'bottom')[] };

/** Base screen: paper background, safe-area aware, optional scroll and tab-bar clearance. */
export function Screen({ children, scroll, tabBarSpace, style, edges = ['top'] }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: edges.includes('top') ? insets.top : 0, paddingBottom: edges.includes('bottom') ? insets.bottom : 0 };
  const bottom = tabBarSpace ? 110 : space.xl;
  if (scroll) {
    return (
      <View style={[{ flex: 1, backgroundColor: t.bg }, pad]}>
        <ScrollView contentContainerStyle={[{ paddingHorizontal: space.lg, paddingBottom: bottom }, style]} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </View>
    );
  }
  return <View style={[{ flex: 1, backgroundColor: t.bg }, pad, style]}>{children}</View>;
}
