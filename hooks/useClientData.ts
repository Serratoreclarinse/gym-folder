import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Exercise } from './useSessions';

export type ClientPackage = {
  id: string;
  coach_id: string;
  package_type: '30min' | '45min' | '1hr';
  total_sessions: number;
  sessions_used: number;
  sessions_remaining: number;
  status: 'active' | 'expired';
  start_date: string;
  duration_weeks: number | null;
};

export type ClientSession = {
  id: string;
  session_date: string;
  duration_minutes: number;
  exercises: Exercise[];
  notes: string | null;
  coach_name: string;
  coach_id: string;
  status: string | null;
};

export type CoachInfo = {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
};

export type NextScheduledSession = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  notes: string | null;
  client_confirmed_at: string | null;
};

export function useClientData() {
  const { user } = useAuth();
  const [pkg, setPkg] = useState<ClientPackage | null>(null);
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [coachInfo, setCoachInfo] = useState<CoachInfo | null>(null);
  const [nextScheduled, setNextScheduled] = useState<NextScheduledSession | null>(null);
  const [upcomingScheduled, setUpcomingScheduled] = useState<NextScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [pkgResult, sessionsResult, scheduledResult] = await Promise.all([
      supabase
        .from('packages')
        .select(`
          id,
          coach_id,
          package_type,
          total_sessions,
          sessions_used,
          sessions_remaining,
          status,
          start_date,
          duration_weeks,
          coach:profiles!packages_coach_id_fkey ( id, name, phone, whatsapp, instagram )
        `)
        .eq('client_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('workout_sessions')
        .select(`
          id,
          coach_id,
          session_date,
          duration_minutes,
          exercises,
          notes,
          status,
          coach:profiles!workout_sessions_coach_id_fkey ( name )
        `)
        .eq('client_id', user.id)
        .lte('session_date', new Date().toISOString().split('T')[0])
        .order('session_date', { ascending: false }),

      supabase
        .from('scheduled_sessions')
        .select('id, scheduled_at, duration_minutes, notes, client_confirmed_at')
        .eq('client_id', user.id)
        .gte('scheduled_at', new Date().toISOString())
        .in('status', ['pending', 'client_confirmed'])
        .order('scheduled_at', { ascending: true }),
    ]);

    if (pkgResult.error) {
      setError(pkgResult.error.message);
    } else if (pkgResult.data) {
      const row = pkgResult.data as any;
      setPkg({
        id: row.id,
        coach_id: row.coach_id,
        package_type: row.package_type,
        total_sessions: row.total_sessions,
        sessions_used: row.sessions_used,
        sessions_remaining: row.sessions_remaining,
        status: row.status,
        start_date: row.start_date,
        duration_weeks: row.duration_weeks ?? null,
      });
      if (row.coach) {
        setCoachInfo({
          id: row.coach.id,
          name: row.coach.name,
          phone: row.coach.phone ?? null,
          whatsapp: row.coach.whatsapp ?? null,
          instagram: row.coach.instagram ?? null,
        });
      }
    } else {
      setPkg(null);
      setCoachInfo(null);
    }

    if (!sessionsResult.error) {
      setSessions(
        (sessionsResult.data ?? []).map((row) => ({
          id: row.id,
          coach_id: (row as any).coach_id,
          session_date: row.session_date,
          duration_minutes: row.duration_minutes,
          exercises: row.exercises as Exercise[],
          notes: row.notes,
          coach_name: (row.coach as { name: string } | null)?.name ?? 'Your coach',
          status: row.status ?? null,
        })),
      );
    }

    if (!scheduledResult.error) {
      const all: NextScheduledSession[] = (scheduledResult.data ?? []).map((r: any) => ({
        id: r.id,
        scheduled_at: r.scheduled_at,
        duration_minutes: r.duration_minutes ?? 60,
        notes: r.notes ?? null,
        client_confirmed_at: r.client_confirmed_at ?? null,
      }));
      setUpcomingScheduled(all);
      setNextScheduled(all[0] ?? null);
    } else {
      setUpcomingScheduled([]);
      setNextScheduled(null);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { pkg, sessions, coachInfo, nextScheduled, upcomingScheduled, loading, error, refetch: fetch };
}
