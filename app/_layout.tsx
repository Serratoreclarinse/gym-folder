import { Slot, useRouter, useSegments } from 'expo-router';
import { DarkTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Appearance, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import * as SystemUI from 'expo-system-ui';
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

// ─── Animated splash ─────────────────────────────────────────────────────────
// Uses a React Native Modal so it renders at the OS level — above the Expo
// Router NavigationContainer and all native navigation views. No z-index battle.
function AnimatedSplash({ shouldFade }: { shouldFade: boolean }) {
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const hasFaded  = useRef(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 7, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (shouldFade && !hasFaded.current) {
      hasFaded.current = true;
      Animated.timing(fadeAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start(() => {
        // Small delay so the opacity=0 frame is committed before the Modal
        // window is dismissed — prevents a 1-frame white flash on iOS.
        setTimeout(() => setVisible(false), 50);
      });
    }
  }, [shouldFade]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={() => {}}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.splash, { opacity: fadeAnim }]}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Text style={styles.splashText}>ELEVATƎ</Text>
        </Animated.View>
        <Text style={styles.splashSub}>Personal Training</Text>
      </Animated.View>
    </Modal>
  );
}

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
function AuthNavigation({ onNavigated }: { onNavigated: () => void }) {
  const { session, profile, loading, needsPasswordReset } = useAuth();
  const segments = useSegments();
  const router   = useRouter();

  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone,    setOnboardingDone]    = useState(false);
  const navigatedOnce = useRef(false);

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

    if (!navigatedOnce.current) {
      navigatedOnce.current = true;
      onNavigated();
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

  // iOS: paint the native root UIView dark so the NavigationContainer backdrop
  // is never white during transitions. Must run in useEffect (not module level)
  // so the native bridge is fully initialized before the call.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync('#0A0A0A');
  }, []);

  const [splashDone, setSplashDone] = useState(false);
  const routingReadyRef = useRef(false);
  const minTimeReadyRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      minTimeReadyRef.current = true;
      if (routingReadyRef.current) setSplashDone(true);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const handleNavigated = useCallback(() => {
    setTimeout(() => {
      routingReadyRef.current = true;
      if (minTimeReadyRef.current) setSplashDone(true);
    }, 600);
  }, []);

  const [fontsLoaded] = useFonts({
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
        {(fontsLoaded || Platform.OS === 'web') && (
          <ThemeProvider>
            <AuthProvider>
              <ThemedStatusBar />
              <AuthNavigation onNavigated={handleNavigated} />
              <Slot />
            </AuthProvider>
          </ThemeProvider>
        )}
      </View>
      <AnimatedSplash shouldFade={splashDone} />
    </NavThemeProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    backgroundColor: '#0A0A0A',
    justifyContent:  'center',
    alignItems:      'center',
    gap:             8,
  },
  splashText: {
    fontSize:      42,
    fontWeight:    '800',
    color:         '#FFFFFF',
    letterSpacing: 5,
  },
  splashSub: {
    fontSize:      13,
    fontWeight:    '500',
    color:         '#666666',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
