import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type ScheduledSession = {
  id: string;
  client_id: string;
  scheduled_at: string;
  notes: string | null;
  status: string | null;
  reschedule_proposed_at: string | null;
};

// Pass clientId to scope to one client, or omit to fetch all upcoming sessions for the coach.
export function useScheduledSessions(clientId?: string) {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    let query = supabase
      .from('scheduled_sessions')
      .select('id, client_id, scheduled_at, notes, status, reschedule_proposed_at')
      .eq('coach_id', profile.id)
      .gte('scheduled_at', new Date().toISOString())
      .in('status', ['pending', 'client_confirmed', 'reschedule_pending'])
      .order('scheduled_at', { ascending: true });
    if (clientId) query = query.eq('client_id', clientId);
    const { data } = await query;
    setSessions((data as ScheduledSession[]) ?? []);
    setLoading(false);
  }, [profile?.id, clientId]);

  useEffect(() => { load(); }, [load]);

  const scheduleSession = async (
    dt: Date,
    notes?: string,
  ): Promise<{ error: string | null; session: ScheduledSession | null }> => {
    if (!profile?.id || !clientId) return { error: 'Missing data', session: null };
    const { data, error } = await supabase
      .from('scheduled_sessions')
      .insert({
        coach_id: profile.id,
        client_id: clientId,
        scheduled_at: dt.toISOString(),
        notes: notes?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();
    if (error) return { error: error.message, session: null };
    const session = data as ScheduledSession;
    setSessions((prev) =>
      [...prev, session].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
      ),
    );
    return { error: null, session };
  };

  const deleteSession = async (id: string) => {
    await supabase.from('scheduled_sessions').delete().eq('id', id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const rescheduleSession = async (id: string, newDt: Date): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('scheduled_sessions')
      .update({ reschedule_proposed_at: newDt.toISOString(), status: 'reschedule_pending' })
      .eq('id', id);
    if (error) return { error: error.message };
    setSessions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, reschedule_proposed_at: newDt.toISOString(), status: 'reschedule_pending' } : s,
      ),
    );
    return { error: null };
  };

  return { sessions, loading, scheduleSession, deleteSession, rescheduleSession, refetch: load };
}
