import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type LastUsed = {
  weight: string;
  sets: string;
  reps: string;
};

export function useClientLastWeights(clientId: string | null) {
  const [map, setMap] = useState<Map<string, LastUsed>>(new Map());

  const load = useCallback(async () => {
    if (!clientId) { setMap(new Map()); return; }

    const { data } = await supabase
      .from('workout_sessions')
      .select('exercises, session_date')
      .eq('client_id', clientId)
      .order('session_date', { ascending: false })
      .limit(50);

    if (!data) return;

    const result = new Map<string, LastUsed>();

    // Iterate oldest → newest so newest values win
    for (const session of [...data].reverse()) {
      const exs = (session.exercises ?? []) as Array<{
        exercise_name: string;
        sets: number | null;
        reps: number | null;
        weight: string | null;
      }>;
      for (const ex of exs) {
        if (!ex.exercise_name?.trim()) continue;
        const key = ex.exercise_name.trim().toLowerCase();
        const existing = result.get(key);
        result.set(key, {
          weight: ex.weight?.trim() || existing?.weight || '',
          sets: ex.sets != null ? String(ex.sets) : (existing?.sets ?? ''),
          reps: ex.reps != null ? String(ex.reps) : (existing?.reps ?? ''),
        });
      }
    }

    setMap(result);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const getLastUsed = useCallback(
    (exerciseName: string): LastUsed | null => {
      const entry = map.get(exerciseName.trim().toLowerCase());
      return entry?.weight ? entry : null;
    },
    [map],
  );

  return { getLastUsed };
}
