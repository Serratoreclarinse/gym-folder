import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type Strike = {
  id: string;
  client_id: string;
  coach_id: string;
  reason: string | null;
  created_at: string;
};

// Standalone function — can be called outside the hook (e.g. from calendar screen)
export async function addStrikeForClient(
  clientId: string,
  coachId: string,
  reason?: string,
): Promise<{ autoDeducted: boolean }> {
  await supabase.from('strikes').insert({
    client_id: clientId,
    coach_id: coachId,
    reason: reason?.trim() || null,
  });

  const { data: allStrikes } = await supabase
    .from('strikes')
    .select('id')
    .eq('client_id', clientId)
    .eq('coach_id', coachId);

  if ((allStrikes?.length ?? 0) >= 3) {
    const { data: pkg } = await supabase
      .from('packages')
      .select('id, sessions_used')
      .eq('client_id', clientId)
      .eq('coach_id', coachId)
      .eq('status', 'active')
      .maybeSingle();

    if (pkg) {
      await supabase
        .from('packages')
        .update({ sessions_used: pkg.sessions_used + 1 })
        .eq('id', pkg.id);
    }

    await supabase
      .from('strikes')
      .delete()
      .eq('client_id', clientId)
      .eq('coach_id', coachId);

    return { autoDeducted: true };
  }

  return { autoDeducted: false };
}

export function useStrikes(clientId?: string) {
  const { profile } = useAuth();
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!profile?.id || !clientId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('strikes')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: true });
    setStrikes(data ?? []);
    setLoading(false);
  }, [profile?.id, clientId]);

  const addStrike = async (reason?: string): Promise<{ autoDeducted: boolean }> => {
    if (!profile?.id || !clientId) return { autoDeducted: false };
    const result = await addStrikeForClient(clientId, profile.id, reason);
    await fetch();
    return result;
  };

  const removeStrike = async (strikeId: string) => {
    await supabase.from('strikes').delete().eq('id', strikeId);
    await fetch();
  };

  useEffect(() => { fetch(); }, [fetch]);

  return { strikes, loading, refetch: fetch, addStrike, removeStrike };
}
