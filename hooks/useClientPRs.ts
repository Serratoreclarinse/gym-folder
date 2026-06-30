import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type PersonalRecord = {
  exercise_name: string;
  best_weight: number;
  best_weight_str: string;
  achieved_date: string;
  session_count: number;
};

function parseWeight(w: string | null | undefined): number {
  if (!w) return 0;
  const match = w.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

export function useClientPRs() {
  const { user } = useAuth();
  const [prs, setPRs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);

    const { data } = await supabase
      .from('workout_sessions')
      .select('exercises, session_date')
      .eq('client_id', user.id)
      .neq('status', 'absent')
      .order('session_date', { ascending: true });

    if (!data) { setLoading(false); return; }

    const map = new Map<string, PersonalRecord>();

    for (const session of data) {
      const exs = (session.exercises ?? []) as Array<{
        exercise_name: string;
        weight: string | null;
      }>;
      for (const ex of exs) {
        const name = ex.exercise_name?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        const w = parseWeight(ex.weight);
        const existing = map.get(key);

        if (!existing) {
          map.set(key, {
            exercise_name: name,
            best_weight: w,
            best_weight_str: ex.weight ?? '',
            achieved_date: session.session_date,
            session_count: 1,
          });
        } else {
          const newBest = w > existing.best_weight;
          map.set(key, {
            exercise_name: existing.exercise_name,
            best_weight: newBest ? w : existing.best_weight,
            best_weight_str: newBest ? (ex.weight ?? '') : existing.best_weight_str,
            achieved_date: newBest ? session.session_date : existing.achieved_date,
            session_count: existing.session_count + 1,
          });
        }
      }
    }

    const result = [...map.values()]
      .filter((pr) => pr.best_weight > 0)
      .sort((a, b) => b.session_count - a.session_count);

    setPRs(result);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return { prs, loading, refetch: load };
}
