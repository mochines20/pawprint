import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PawTabBar } from '@/components';
import { CareScreen } from '@/screens/CareScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { JournalScreen } from '@/screens/JournalScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function TabNavigator() {
  return (
    <Tab.Navigator tabBar={(props) => <PawTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Journal" component={JournalScreen} />
      <Tab.Screen name="Care" component={CareScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
