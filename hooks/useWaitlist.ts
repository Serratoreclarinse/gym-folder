import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type WaitlistEntry = {
  id: string;
  session_id: string;
  client_id: string;
  client_name: string;
  client_phone: string | null;
  position: number;
  status: 'waiting' | 'notified' | 'confirmed' | 'skipped';
  created_at: string;
};

export function useWaitlist(coachId: string | undefined) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    const { data } = await supabase
      .from('waitlist')
      .select(`
        id, session_id, client_id, position, status, created_at,
        client:profiles!waitlist_client_id_fkey(name, phone)
      `)
      .eq('coach_id', coachId)
      .in('status', ['waiting', 'notified'])
      .order('position', { ascending: true });

    setEntries(
      (data ?? []).map((row) => ({
        id: row.id,
        session_id: row.session_id,
        client_id: row.client_id,
        client_name: (row.client as { name: string; phone: string | null } | null)?.name ?? 'Unknown',
        client_phone: (row.client as { name: string; phone: string | null } | null)?.phone ?? null,
        position: row.position,
        status: row.status as WaitlistEntry['status'],
        created_at: row.created_at,
      }))
    );
    setLoading(false);
  }, [coachId]);

  const countBySession = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      map[e.session_id] = (map[e.session_id] ?? 0) + 1;
    }
    return map;
  }, [entries]);

  const totalCount = entries.length;

  const addToWaitlist = async (sessionId: string, clientId: string): Promise<{ error: string | null }> => {
    if (!coachId) return { error: 'Not authenticated' };
    const forSession = entries.filter((e) => e.session_id === sessionId);
    const maxPos = forSession.reduce((max, e) => Math.max(max, e.position), 0);
    const { error } = await supabase.from('waitlist').insert({
      coach_id: coachId,
      client_id: clientId,
      session_id: sessionId,
      position: maxPos + 1,
      status: 'waiting',
    });
    if (error) return { error: error.message };
    await fetchEntries();
    return { error: null };
  };

  const updateStatus = async (entryId: string, status: WaitlistEntry['status']) => {
    await supabase.from('waitlist').update({ status }).eq('id', entryId);
    await fetchEntries();
  };

  const removeEntry = async (entryId: string) => {
    await supabase.from('waitlist').delete().eq('id', entryId);
    await fetchEntries();
  };

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  return {
    entries,
    countBySession,
    totalCount,
    addToWaitlist,
    updateStatus,
    removeEntry,
    loading,
    refetch: fetchEntries,
  };
}
