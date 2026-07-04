import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { AuthProvider, useAuth } from '@/context/AuthContext';
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
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inCoachGroup = segments[0] === '(coach)';
    const inClientGroup = segments[0] === '(client)';
    const inAdminGroup = segments[0] === '(admin)';

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
  }, [session, profile, loading, segments]);

  return null;
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

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthNavigation />
      <Slot />
    </AuthProvider>
  );
}
