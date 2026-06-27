import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type ProgressEntry = {
  id: string;
  client_id: string;
  coach_id: string;
  date: string; // YYYY-MM-DD
  weight: number | null;
  body_fat_percentage: number | null;
  muscle_mass: number | null;
  waist: number | null;
  hip: number | null;
  chest: number | null;
  arms: number | null;
  notes: string | null;
  created_at: string;
};

export type NewProgressEntry = Omit<ProgressEntry, 'id' | 'coach_id' | 'created_at'>;

export function useProgress(clientId: string) {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!profile?.id || !clientId) { setLoading(false); return; }
    setLoading(true);

    const { data } = await supabase
      .from('client_progress')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', profile.id)
      .order('date', { ascending: true });

    setEntries(data ?? []);
    setLoading(false);
  }, [profile?.id, clientId]);

  const addEntry = async (entry: NewProgressEntry) => {
    if (!profile?.id) return;
    await supabase.from('client_progress').insert({ ...entry, coach_id: profile.id });
    await fetchEntries();
  };

  const updateEntry = async (id: string, data: Partial<NewProgressEntry>) => {
    await supabase.from('client_progress').update(data).eq('id', id);
    await fetchEntries();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from('client_progress').delete().eq('id', id);
    await fetchEntries();
  };

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  return { entries, loading, refetch: fetchEntries, addEntry, updateEntry, deleteEntry };
}
