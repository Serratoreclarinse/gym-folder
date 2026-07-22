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

export function useClientPRs() {
  const { user } = useAuth();
  const [prs, setPRs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);

    const { data } = await supabase
      .from('exercise_records')
      .select('exercise_name, best_kg, best_reps, recorded_at')
      .eq('client_id', user.id)
      .order('recorded_at', { ascending: true });

    if (!data) { setLoading(false); return; }

    const map = new Map<string, PersonalRecord>();

    for (const record of data) {
      const name = record.exercise_name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const kg = record.best_kg ?? 0;
      const date = (record.recorded_at as string).slice(0, 10);
      const existing = map.get(key);

      const weightStr = kg > 0
        ? `${kg} kg`
        : (record.best_reps ? `${record.best_reps} reps BW` : 'BW');

      if (!existing) {
        map.set(key, {
          exercise_name: name,
          best_weight: kg,
          best_weight_str: weightStr,
          achieved_date: date,
          session_count: 1,
        });
      } else {
        const newBest = kg > existing.best_weight;
        map.set(key, {
          ...existing,
          best_weight: newBest ? kg : existing.best_weight,
          best_weight_str: newBest ? weightStr : existing.best_weight_str,
          achieved_date: newBest ? date : existing.achieved_date,
          session_count: existing.session_count + 1,
        });
      }
    }

    const result = [...map.values()]
      .sort((a, b) => b.best_weight - a.best_weight || a.exercise_name.localeCompare(b.exercise_name));

    setPRs(result);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return { prs, loading, refetch: load };
}
