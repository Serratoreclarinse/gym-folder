import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type RecentExercise = {
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string;
  duration: string;
  count: number;
};

export function useExerciseHistory() {
  const { profile } = useAuth();
  const [history, setHistory] = useState<RecentExercise[]>([]);

  const load = useCallback(async () => {
    if (!profile?.id) return;

    const { data } = await supabase
      .from('workout_sessions')
      .select('exercises, created_at')
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(60);

    if (!data) return;

    const map = new Map<string, RecentExercise>();

    // Oldest → newest so newer values overwrite (most recent values kept)
    for (const session of [...data].reverse()) {
      const exs = (session.exercises ?? []) as Array<{
        exercise_name: string;
        sets: number | null;
        reps: number | null;
        weight: string | null;
        duration: string | null;
      }>;
      for (const ex of exs) {
        if (!ex.exercise_name?.trim()) continue;
        const key = ex.exercise_name.trim().toLowerCase();
        const existing = map.get(key);
        map.set(key, {
          exercise_name: ex.exercise_name.trim(),
          sets: ex.sets != null ? String(ex.sets) : (existing?.sets ?? ''),
          reps: ex.reps != null ? String(ex.reps) : (existing?.reps ?? ''),
          weight: ex.weight ?? existing?.weight ?? '',
          duration: ex.duration ?? existing?.duration ?? '',
          count: (existing?.count ?? 0) + 1,
        });
      }
    }

    setHistory([...map.values()].sort((a, b) => b.count - a.count));
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  return { history, reload: load };
}
