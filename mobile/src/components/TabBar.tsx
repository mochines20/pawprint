import { Pressable, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

const ICONS: Record<string, { icon: IconName; label: string }> = {
  Home: { icon: 'home', label: 'Home' },
  Journal: { icon: 'book', label: 'Journal' },
  Care: { icon: 'care', label: 'Care' },
  Profile: { icon: 'user', label: 'Profile' },
};

/** Floating ink pill with a raised amber camera button in the centre (thumb zone). */
export function PawTabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes;
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const tab = (route: (typeof routes)[number], index: number) => {
    const focused = state.index === index;
    const meta = ICONS[route.name];
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        onPress={() => navigation.navigate(route.name)}
        style={{ width: 62, height: 56, alignItems: 'center', justifyContent: 'center', gap: 3 }}
      >
        <Icon name={meta.icon} size={21} color={focused ? t.amber : '#BDBAB2'} />
        <AppText size={10.5} weight="semi" color={focused ? t.amber : '#BDBAB2'}>{meta.label}</AppText>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 10) }}>
      <View style={{ height: 66, backgroundColor: '#151515', borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderWidth: 2, borderColor: t.edge }}>
        {left.map((r, i) => tab(r, i))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Spot a cat"
          onPress={() => navigation.getParent()?.navigate('Spot')}
          style={{ width: 58, height: 58, borderRadius: 29, marginTop: -34, backgroundColor: t.amber, borderWidth: 3.5, borderColor: t.bg, alignItems: 'center', justifyContent: 'center', shadowColor: t.edge, shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 4 }}
        >
          <Icon name="cam" size={26} color="#151515" />
        </Pressable>
        {right.map((r, i) => tab(r, i + 2))}
      </View>
    </View>
  );
}
