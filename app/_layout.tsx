import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

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

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
    } else if (profile) {
      if (profile.role === 'coach' && !inCoachGroup) {
        router.replace('/(coach)');
      } else if (profile.role === 'client' && !inClientGroup) {
        router.replace('/(client)');
      }
    }
  }, [session, profile, loading, segments]);

  return null;
}

export default function RootLayout() {
  useAuthDeepLink();

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AuthNavigation />
      <Slot />
    </AuthProvider>
  );
}
