import { Slot, useRouter, useSegments } from 'expo-router';
import { DarkTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Appearance, Platform, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useFonts } from 'expo-font';
import {
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  Montserrat_600SemiBold,
} from '@expo-google-fonts/montserrat';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';

// Android: force React Navigation's NavigationContainer to use DarkTheme
// (iOS ignores Appearance.setColorScheme — it's a documented no-op there)
Appearance.setColorScheme('dark');

const AppNavTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: '#0A0A0A', card: '#0A0A0A' },
};

// ─── Deep-link handler ───────────────────────────────────────────────────────
function useAuthDeepLink() {
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url) return;
      if (url.includes('code=') || url.includes('access_token=')) {
        await supabase.auth.exchangeCodeForSession(url);
      }
    };
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);
}

// ─── OTA update checker ──────────────────────────────────────────────────────
function useAutoUpdate() {
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch { /* silently ignore */ }
    })();
  }, []);
}

// ─── Auth-based routing ──────────────────────────────────────────────────────
function AuthNavigation() {
  const { session, profile, loading, needsPasswordReset } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone,    setOnboardingDone]    = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('onboarding_done').then((val) => {
      setOnboardingDone(val === 'true');
      setOnboardingChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!onboardingChecked) return;

    const inOnboarding  = segments[0] === 'onboarding';
    const inAuthGroup   = segments[0] === '(auth)';
    const inCoachGroup  = segments[0] === '(coach)';
    const inClientGroup = segments[0] === '(client)';
    const inAdminGroup  = segments[0] === '(admin)';
    const onResetScreen = segments[1] === 'reset-password';

    if (Platform.OS !== 'web' && !onboardingDone && !inOnboarding) {
      router.replace('/onboarding');
      return;
    }

    if (loading) return;

    if (needsPasswordReset) {
      if (!onResetScreen) {
        router.replace('/(auth)/reset-password');
        return;
      }
    } else if (!session) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
        return;
      }
    } else if (profile) {
      if (profile.role === 'coach'  && !inCoachGroup)  { router.replace('/(coach)');  return; }
      if (profile.role === 'client' && !inClientGroup) { router.replace('/(client)'); return; }
      if (profile.role === 'admin'  && !inAdminGroup)  { router.replace('/(admin)');  return; }
    }
  }, [session, profile, loading, needsPasswordReset, segments, onboardingDone, onboardingChecked]);

  return null;
}

// ─── Status bar ──────────────────────────────────────────────────────────────
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

// ─── Root layout ─────────────────────────────────────────────────────────────
export default function RootLayout() {
  useAuthDeepLink();
  useAutoUpdate();

  const [fontsLoaded, fontError] = useFonts({
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  return (
    <NavThemeProvider value={AppNavTheme}>
      <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        {(fontsLoaded || fontError || Platform.OS === 'web') && (
          <ThemeProvider>
            <AuthProvider>
              <ThemedStatusBar />
              <AuthNavigation />
              <Slot />
            </AuthProvider>
          </ThemeProvider>
        )}
      </View>
    </NavThemeProvider>
  );
}
