import { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type UserRole = 'coach' | 'client';

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
    role: meta.role === 'coach' ? 'coach' : 'client',
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
    const jwtRole = (session.user.user_metadata?.role === 'coach' ? 'coach' : 'client') as UserRole;
    await syncProfileFromDB(session.user.id, jwtRole);
  };

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
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

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          clearTimeout(timeout);
          setLoading(false);
        }
      }
    );

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
