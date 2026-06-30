import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type ProgressPhoto = {
  id: string;
  file_url: string;
  label: string | null;
  date: string;
};

export function useClientProgressPhotos() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('client_files')
      .select('id, file_url, label, date')
      .eq('client_id', user.id)
      .eq('category', 'progress')
      .neq('file_type', 'link')
      .order('date', { ascending: false });
    setPhotos((data as ProgressPhoto[]) ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return { photos, loading, refetch: load };
}
