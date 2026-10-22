import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { darkP, light } from '@/theme';
import { useSession } from '@/hooks/useSession';
import { fetchProfile } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AppFlow } from '@/navigation/AppFlow';
import { RootNavigator } from '@/navigation/RootNavigator';
import { LaunchScreen } from '@/screens/LaunchScreen';
import { PasswordResetScreen } from '@/screens/PasswordResetScreen';

const ONBOARD_KEY = 'pawprint:onboarded';

export default function App() {
  const scheme = useColorScheme();
  const [fontsLoaded] = useFonts({ Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold });
  const { session, ready } = useSession();
  const [launching, setLaunching] = useState(true);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [profileSetupComplete, setProfileSetupComplete] = useState<boolean | null>(!isSupabaseConfigured);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    const handleUrl = async (url: string | null | undefined) => {
      if (!url) return;
      const fragment = url.split('#')[1] || url.split('?')[1] || '';
      const values = new URLSearchParams(fragment);
      if (values.get('type') !== 'recovery') return;
      const accessToken = values.get('access_token');
      const refreshToken = values.get('refresh_token');
      if (accessToken && refreshToken) await import('@/lib/supabase').then(({ supabase }) => supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }));
      setPasswordRecovery(true);
    };
    Linking.getInitialURL().then(handleUrl).catch(() => undefined);
    const subscription = Linking.addEventListener('url', ({ url }) => { void handleUrl(url); });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARD_KEY).then((v) => setOnboarded(v === '1')).catch(() => setOnboarded(false));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !session) {
      setProfileSetupComplete(true);
      return;
    }
    let active = true;
    setProfileSetupComplete(null);
    fetchProfile().then((profile) => {
      if (active) setProfileSetupComplete(Boolean(profile.onboarding_completed));
    }).catch(() => {
      // Do not block the app during a temporary profile API outage.
      if (active) setProfileSetupComplete(true);
    });
    return () => { active = false; };
  }, [session]);

  const finishOnboarding = useCallback(() => {
    setOnboarded(true);
    AsyncStorage.setItem(ONBOARD_KEY, '1').catch(() => {});
  }, []);

  const finishProfileSetup = useCallback(() => setProfileSetupComplete(true), []);

  const navTheme = useMemo(() => {
    const p = scheme === 'dark' ? darkP : light;
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, background: p.bg, card: p.bg, text: p.ink, border: p.line, primary: p.amber } };
  }, [scheme]);

  if (!fontsLoaded || onboarded === null || !ready || profileSetupComplete === null) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppFlow.Provider value={{ finishOnboarding, finishProfileSetup }}>
          <NavigationContainer theme={navTheme}>
            <RootNavigator onboarded={onboarded} signedIn={!!session} needsProfileSetup={isSupabaseConfigured && !!session && !profileSetupComplete} passwordRecovery={passwordRecovery} onPasswordRecoveryDone={() => setPasswordRecovery(false)} />
          </NavigationContainer>
        </AppFlow.Provider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {launching && <LaunchScreen onDone={() => setLaunching(false)} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
