import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type TagConfig = { label: string; color: string };

export const PREDEFINED_TAGS: TagConfig[] = [
  { label: 'VIP', color: '#FFD700' },
  { label: 'Online', color: '#2196F3' },
  { label: 'Beginner', color: '#4CAF50' },
  { label: 'Advanced', color: '#FF5722' },
  { label: 'Paused', color: '#9E9E9E' },
];

// Pass clientId to scope to one client, or omit to fetch all clients' labels for the coach.
export function useClientLabels(clientId?: string) {
  const { profile } = useAuth();
  const [labels, setLabels] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    let query = supabase
      .from('client_labels')
      .select('client_id, tags')
      .eq('coach_id', profile.id);
    if (clientId) query = query.eq('client_id', clientId);
    const { data } = await query;
    const map: Record<string, string[]> = {};
    for (const row of data ?? []) {
      map[row.client_id] = row.tags ?? [];
    }
    setLabels(map);
    setLoading(false);
  }, [profile?.id, clientId]);

  useEffect(() => { load(); }, [load]);

  const tagsFor = (cid: string) => labels[cid] ?? [];

  const toggleTag = async (cid: string, tag: string) => {
    if (!profile?.id) return;
    const current = labels[cid] ?? [];
    const newTags = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    setLabels((prev) => ({ ...prev, [cid]: newTags }));
    await supabase
      .from('client_labels')
      .upsert(
        { coach_id: profile.id, client_id: cid, tags: newTags },
        { onConflict: 'coach_id,client_id' },
      );
  };

  return { labels, tagsFor, loading, toggleTag, refetch: load };
}
