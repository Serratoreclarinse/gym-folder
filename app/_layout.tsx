import { Slot, useRouter } from 'expo-router';
import { DarkTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
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
  const router = useRouter();

  const sessionId   = session?.user?.id ?? null;
  const profileRole = profile?.role     ?? null;

  useEffect(() => {
    // Don't navigate while auth is still resolving
    if (loading) return;

    let live = true;
    AsyncStorage.getItem('onboarding_done').then((val) => {
      if (!live) return;

      if (!sessionId) {
        // Not logged in: show onboarding for first-timers, login otherwise
        if (Platform.OS !== 'web' && val !== 'true') {
          router.replace('/onboarding' as any);
        } else {
          router.replace('/(auth)/login' as any);
        }
        return;
      }

      // Logged in: always go to role screen — never bounce back to onboarding
      if (needsPasswordReset) { router.replace('/(auth)/reset-password' as any); return; }
      if      (profileRole === 'coach')  router.replace('/(coach)'  as any);
      else if (profileRole === 'client') router.replace('/(client)' as any);
      else if (profileRole === 'admin')  router.replace('/(admin)'  as any);
    });

    return () => { live = false; };
  }, [sessionId, profileRole, loading, needsPasswordReset]);

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
