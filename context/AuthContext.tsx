import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const WEB_SESSION_KEY = 'gym_auth_session';

function saveWebSession(session: Session | null) {
  if (Platform.OS !== 'web') return;
  try {
    if (session) {
      localStorage.setItem(WEB_SESSION_KEY, JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }));
    } else {
      localStorage.removeItem(WEB_SESSION_KEY);
    }
  } catch {}
}

export type UserRole = 'coach' | 'client' | 'admin';

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  avatar_url: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  profileError: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

function buildProfileFromSession(session: Session): Profile {
  const meta = session.user.user_metadata ?? {};
  return {
    id: session.user.id,
    name: meta.name || session.user.email || '',
    email: session.user.email || '',
    role: meta.role === 'coach' ? 'coach' : meta.role === 'admin' ? 'admin' : 'client',
    phone: null,
    whatsapp: null,
    instagram: null,
    avatar_url: null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  async function syncProfileFromDB(userId: string, jwtRole: UserRole) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) {
        setProfile({ ...(data as Profile), role: jwtRole });
      }
    } catch {
      // DB sync failed — JWT metadata profile stays active
    }
  }

  const refreshProfile = async () => {
    if (!session?.user) return;
    const meta = session.user.user_metadata ?? {};
    const jwtRole = (meta.role === 'coach' ? 'coach' : meta.role === 'admin' ? 'admin' : 'client') as UserRole;
    await syncProfileFromDB(session.user.id, jwtRole);
  };

  useEffect(() => {
    // Check upfront if we have tokens to restore — needed to handle the race
    // where INITIAL_SESSION fires (with null) before setSession resolves.
    let hasStoredSession = false;
    if (Platform.OS === 'web') {
      try { hasStoredSession = !!localStorage.getItem(WEB_SESSION_KEY); } catch {}
    }

    const timeout = setTimeout(() => setLoading(false), 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        saveWebSession(session);
        setSession(session);

        if (session?.user) {
          const metaProfile = buildProfileFromSession(session);
          setProfile(metaProfile);
          setProfileError(null);
          syncProfileFromDB(session.user.id, metaProfile.role);
        } else {
          setProfile(null);
          setProfileError(null);
        }

        if (event === 'INITIAL_SESSION') {
          if (session || !hasStoredSession) {
            // Got a session OR nothing to restore — done loading
            clearTimeout(timeout);
            setLoading(false);
          }
          // If no session but we have stored tokens: keep loading=true and
          // wait for the SIGNED_IN event that setSession will fire below.
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          clearTimeout(timeout);
          setLoading(false);
        }
      }
    );

    // Restore session AFTER listener is set up so SIGNED_IN is caught
    if (Platform.OS === 'web' && hasStoredSession) {
      try {
        const saved = localStorage.getItem(WEB_SESSION_KEY);
        const tokens = JSON.parse(saved!);
        supabase.auth.setSession(tokens).catch(() => {
          clearTimeout(timeout);
          setLoading(false);
        });
      } catch {
        clearTimeout(timeout);
        setLoading(false);
      }
    }

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, profileError, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
