import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthScreen } from '@/screens/AuthScreen';
import { CareFlagScreen } from '@/screens/CareFlagScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { ProfileSetupScreen } from '@/screens/ProfileSetupScreen';
import { RewardScreen } from '@/screens/RewardScreen';
import { SpotScreen } from '@/screens/SpotScreen';
import { TabNavigator } from './TabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

type Props = { onboarded: boolean; signedIn: boolean; needsProfileSetup: boolean };

export function RootNavigator({ onboarded, signedIn, needsProfileSetup }: Props) {
  const needsAuth = isSupabaseConfigured && !signedIn;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {needsAuth ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : !onboarded ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : needsProfileSetup ? (
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="Spot" component={SpotScreen} options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Reward" component={RewardScreen} options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="CareFlag" component={CareFlagScreen} options={{ presentation: 'modal' }} />
        </>
      )}
    </Stack.Navigator>
  );
}
