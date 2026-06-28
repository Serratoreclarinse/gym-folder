import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type GoalStatus = 'active' | 'achieved' | 'dropped';

export type ClientGoal = {
  id: string;
  client_id: string;
  coach_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  status: GoalStatus;
  created_at: string;
};

export function useGoals(clientId: string) {
  const { profile } = useAuth();
  const [goals, setGoals] = useState<ClientGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id || !clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('client_goals')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (!error && data) setGoals(data as ClientGoal[]);
  }, [clientId, profile?.id]);

  useEffect(() => { load(); }, [load]);

  const addGoal = async (
    title: string,
    description: string,
    targetDate: string,
  ): Promise<{ error: string | null }> => {
    if (!profile?.id) return { error: 'Not authenticated' };
    const { data, error } = await supabase
      .from('client_goals')
      .insert({
        client_id: clientId,
        coach_id: profile.id,
        title: title.trim(),
        description: description.trim() || null,
        target_date: targetDate || null,
        status: 'active',
      })
      .select()
      .single();
    if (error) return { error: error.message };
    setGoals((prev) => [data as ClientGoal, ...prev]);
    return { error: null };
  };

  const updateStatus = async (
    id: string,
    status: GoalStatus,
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('client_goals')
      .update({ status })
      .eq('id', id);
    if (error) return { error: error.message };
    setGoals((prev) => prev.map((g) => g.id === id ? { ...g, status } : g));
    return { error: null };
  };

  const deleteGoal = async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('client_goals').delete().eq('id', id);
    if (error) return { error: error.message };
    setGoals((prev) => prev.filter((g) => g.id !== id));
    return { error: null };
  };

  return { goals, loading, refetch: load, addGoal, updateStatus, deleteGoal };
}
