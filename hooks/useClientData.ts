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
  status: 'pending' | 'client_confirmed' | 'reschedule_pending';
  reschedule_proposed_at: string | null;
  original_scheduled_at: string | null;
  reschedule_reason: string | null;
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
        .order('status', { ascending: true })   // 'active' sorts before 'expired'
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
        .select('id, scheduled_at, duration_minutes, notes, client_confirmed_at, status, reschedule_proposed_at, original_scheduled_at, reschedule_reason')
        .eq('client_id', user.id)
        .gte('scheduled_at', new Date().toISOString())
        .in('status', ['pending', 'client_confirmed', 'reschedule_pending'])
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
      // Fallback to package coach name when the join returns null (dual-FK ambiguity)
      const pkgCoachName = (pkgResult.data as any)?.coach?.name as string | undefined;
      setSessions(
        (sessionsResult.data ?? []).map((row) => ({
          id: row.id,
          coach_id: (row as any).coach_id,
          session_date: row.session_date,
          duration_minutes: row.duration_minutes,
          exercises: row.exercises as Exercise[],
          notes: row.notes,
          coach_name: (row.coach as { name: string } | null)?.name ?? pkgCoachName ?? 'Your coach',
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
        status: (r.status ?? 'pending') as 'pending' | 'client_confirmed' | 'reschedule_pending',
        reschedule_proposed_at: r.reschedule_proposed_at ?? null,
        original_scheduled_at: r.original_scheduled_at ?? null,
        reschedule_reason: r.reschedule_reason ?? null,
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

  // Real-time: re-fetch when package or sessions change for this client
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`client-data-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages', filter: `client_id=eq.${user.id}` }, () => fetch())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'workout_sessions', filter: `client_id=eq.${user.id}` }, () => fetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_sessions', filter: `client_id=eq.${user.id}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetch]);

  return { pkg, sessions, coachInfo, nextScheduled, upcomingScheduled, loading, error, refetch: fetch };
}
