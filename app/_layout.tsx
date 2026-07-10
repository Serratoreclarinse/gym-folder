import { Slot, useRouter, useSegments } from 'expo-router';
import { DarkTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
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

function AnimatedSplash() {
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 7, useNativeDriver: true }).start();

    const t = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    }, 900);

    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.splash, { opacity: fadeAnim }]} pointerEvents="none">
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Text style={styles.splashText}>ELEVATƎ</Text>
      </Animated.View>
      <Text style={styles.splashSub}>Personal Training</Text>
    </Animated.View>
  );
}

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
      if (!onResetScreen) router.replace('/(auth)/reset-password');
      return;
    }

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
    } else if (profile) {
      if      (profile.role === 'coach'  && !inCoachGroup)  router.replace('/(coach)');
      else if (profile.role === 'client' && !inClientGroup) router.replace('/(client)');
      else if (profile.role === 'admin'  && !inAdminGroup)  router.replace('/(admin)');
    }
  }, [session, profile, loading, needsPasswordReset, segments, onboardingDone, onboardingChecked]);

  return null;
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  useAuthDeepLink();
  useAutoUpdate();

  const [fontsLoaded] = useFonts({
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  return (
    <NavThemeProvider value={DarkTheme}>
      <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        {(fontsLoaded || Platform.OS === 'web') && (
          <ThemeProvider>
            <AuthProvider>
              <ThemedStatusBar />
              <AuthNavigation />
              <Slot />
            </AuthProvider>
          </ThemeProvider>
        )}
        {/* Splash renders immediately — covers the font-loading gap AND auth wait */}
        <AnimatedSplash />
      </View>
    </NavThemeProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0A0A',
    justifyContent:  'center',
    alignItems:      'center',
    gap:             8,
    zIndex:          9999,
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
