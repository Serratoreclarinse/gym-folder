import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type StrikeAlert = {
  client_id: string;
  client_name: string;
  strike_count: number;
  latest_strike_date: string;
};

export function useStrikeAlerts() {
  const { profile } = useAuth();
  const [alerts, setAlerts] = useState<StrikeAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return; }
    setLoading(true);

    const { data } = await supabase
      .from('strikes')
      .select('client_id, created_at, client:profiles!strikes_client_id_fkey(name)')
      .eq('coach_id', profile.id);

    if (!data) { setLoading(false); return; }

    const map = new Map<string, StrikeAlert>();
    for (const row of data) {
      const existing = map.get(row.client_id);
      if (!existing) {
        map.set(row.client_id, {
          client_id: row.client_id,
          client_name: (row.client as { name: string } | null)?.name ?? 'Unknown',
          strike_count: 1,
          latest_strike_date: row.created_at,
        });
      } else {
        existing.strike_count++;
        if (row.created_at > existing.latest_strike_date) {
          existing.latest_strike_date = row.created_at;
        }
      }
    }

    setAlerts(
      [...map.values()].sort((a, b) => b.strike_count - a.strike_count)
    );
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { alerts, loading, refetch: fetch };
}
