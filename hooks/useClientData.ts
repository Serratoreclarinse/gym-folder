import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Exercise } from './useSessions';

export type ClientPackage = {
  id: string;
  package_type: '30min' | '45min' | '1hr';
  total_sessions: number;
  sessions_used: number;
  sessions_remaining: number;
  status: 'active' | 'expired';
  start_date: string;
};

export type ClientSession = {
  id: string;
  session_date: string;
  duration_minutes: number;
  exercises: Exercise[];
  notes: string | null;
  coach_name: string;
};

export function useClientData() {
  const { user } = useAuth();
  const [pkg, setPkg] = useState<ClientPackage | null>(null);
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [pkgResult, sessionsResult] = await Promise.all([
      // Most recent active package; fall back to most recent expired
      supabase
        .from('packages')
        .select('id, package_type, total_sessions, sessions_used, sessions_remaining, status, start_date')
        .eq('client_id', user.id)
        .eq('status', 'active')                 // prefer active package
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),                          // null (no error) when no rows

      supabase
        .from('workout_sessions')
        .select(`
          id,
          session_date,
          duration_minutes,
          exercises,
          notes,
          coach:profiles!workout_sessions_coach_id_fkey ( name )
        `)
        .eq('client_id', user.id)
        .order('session_date', { ascending: false }),
    ]);

    if (pkgResult.error) {
      setError(pkgResult.error.message);
    } else {
      setPkg(pkgResult.data ?? null);
    }

    if (sessionsResult.error) {
      setError(sessionsResult.error.message);
    } else {
      setSessions(
        (sessionsResult.data ?? []).map((row) => ({
          id: row.id,
          session_date: row.session_date,
          duration_minutes: row.duration_minutes,
          exercises: row.exercises as Exercise[],
          notes: row.notes,
          coach_name: (row.coach as { name: string } | null)?.name ?? 'Your coach',
        }))
      );
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { pkg, sessions, loading, error, refetch: fetch };
}
