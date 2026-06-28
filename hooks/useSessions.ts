import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type Exercise = {
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight: string | null;
  duration: string | null;
  notes: string | null;
};

export type WorkoutSession = {
  id: string;
  package_id: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  session_date: string;
  scheduled_time: string | null;
  duration_minutes: number;
  exercises: Exercise[];
  notes: string | null;
  status: 'confirmed' | 'pending' | 'absent';
  session_type: 'gym' | 'home';
  created_at: string;
};

export function useSessions(clientId?: string) {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    let query = supabase
      .from('workout_sessions')
      .select(`
        id,
        package_id,
        client_id,
        session_date,
        scheduled_time,
        duration_minutes,
        exercises,
        notes,
        status,
        session_type,
        created_at,
        client:profiles!workout_sessions_client_id_fkey (name, phone)
      `)
      .eq('coach_id', profile.id)
      .order('session_date', { ascending: false });

    if (clientId) query = query.eq('client_id', clientId);

    const { data, error: err } = await query;

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSessions(
      (data ?? []).map((row) => ({
        id: row.id,
        package_id: row.package_id,
        client_id: row.client_id,
        client_name: (row.client as { name: string; phone: string | null } | null)?.name ?? 'Unknown',
        client_phone: (row.client as { name: string; phone: string | null } | null)?.phone ?? null,
        session_date: row.session_date,
        scheduled_time: row.scheduled_time ?? null,
        duration_minutes: row.duration_minutes,
        exercises: row.exercises as Exercise[],
        notes: row.notes,
        status: (row.status as WorkoutSession['status']) ?? 'confirmed',
        session_type: (row.session_type as 'gym' | 'home') ?? 'gym',
        created_at: row.created_at,
      }))
    );
    setLoading(false);
  }, [profile?.id, clientId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { sessions, loading, error, refetch: fetch };
}
