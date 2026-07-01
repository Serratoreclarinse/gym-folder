import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Explicitly use window.localStorage on web so the session survives page refreshes.
// Passing undefined lets Supabase detect the environment, but Expo's bundler can
// confuse that detection — so we hand the storage directly.
const storage =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.localStorage
    : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
  },
});
