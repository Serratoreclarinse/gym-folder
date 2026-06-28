import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type CustomExercise = {
  id: string;
  name: string;
  muscle_group: string;
};

export function useCustomExercises() {
  const { profile } = useAuth();
  const [exercises, setExercises] = useState<CustomExercise[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('custom_exercises')
      .select('id, name, muscle_group')
      .eq('coach_id', profile.id)
      .order('name', { ascending: true });
    setExercises((data as CustomExercise[]) ?? []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  const addExercise = async (name: string, muscleGroup: string): Promise<{ error: string | null }> => {
    if (!profile?.id) return { error: 'Not logged in' };
    const trimmed = name.trim();
    if (!trimmed) return { error: 'Name is required' };

    const { data, error } = await supabase
      .from('custom_exercises')
      .insert({ coach_id: profile.id, name: trimmed, muscle_group: muscleGroup })
      .select('id, name, muscle_group')
      .single();

    if (error) return { error: error.message };
    setExercises((prev) => [...prev, data as CustomExercise].sort((a, b) => a.name.localeCompare(b.name)));
    return { error: null };
  };

  return { exercises, loading, addExercise };
}
