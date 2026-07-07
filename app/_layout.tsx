import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
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

// Stays mounted for the entire app lifetime — watches auth state and navigates.
// This avoids the bug where index.tsx was unmounted after redirecting to login
// and could no longer react to SIGNED_IN events.
function AuthNavigation() {
  const { session, profile, loading, needsPasswordReset } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onResetScreen = segments[1] === 'reset-password';
    const inCoachGroup = segments[0] === '(coach)';
    const inClientGroup = segments[0] === '(client)';
    const inAdminGroup = segments[0] === '(admin)';

    if (needsPasswordReset) {
      if (!onResetScreen) router.replace('/(auth)/reset-password');
      return;
    }

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
    } else if (profile) {
      if (profile.role === 'coach' && !inCoachGroup) {
        router.replace('/(coach)');
      } else if (profile.role === 'client' && !inClientGroup) {
        router.replace('/(client)');
      } else if (profile.role === 'admin' && !inAdminGroup) {
        router.replace('/(admin)');
      }
    }
  }, [session, profile, loading, needsPasswordReset, segments]);

  return null;
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
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
      } catch {
        // silently ignore — update applies on next launch if this fails
      }
    })();
  }, []);
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

  // On web (Vercel static build), fonts load via CSS — don't block render
  if (!fontsLoaded && Platform.OS !== 'web') return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <ThemedStatusBar />
        <AuthNavigation />
        <Slot />
      </AuthProvider>
    </ThemeProvider>
  );
}
