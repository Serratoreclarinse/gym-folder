import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ProgressPhoto = {
  id: string;
  client_id: string;
  coach_id: string;
  file_url: string;
  note: string | null;
  sent_at: string;
};

// ── Coach view: all photos for a specific client ─────────────────────────────
export function useClientProgressPhotos(clientId: string) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('client_id', clientId)
      .order('sent_at', { ascending: false });
    setLoading(false);
    if (!error && data) setPhotos(data as ProgressPhoto[]);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  return { photos, loading, refetch: load };
}

// ── Client view: own photos ────────────────────────────────────────────────────
export function useMyProgressPhotos(clientId: string | null) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('client_id', clientId)
      .order('sent_at', { ascending: false });
    setLoading(false);
    if (!error && data) setPhotos(data as ProgressPhoto[]);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const sendPhoto = async (
    coachId: string,
    uri: string,
    note: string,
  ): Promise<{ error: string | null }> => {
    if (!clientId) return { error: 'Not authenticated' };

    const ext = uri.split('.').pop()?.toLowerCase()?.split('?')[0] ?? 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].includes(ext) ? ext : 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
    const storagePath = `progress/${clientId}/${fileName}`;

    const formData = new FormData();
    formData.append('file', { uri, name: fileName, type: 'image/jpeg' } as any);

    const { error: uploadError } = await supabase.storage
      .from('client-files')
      .upload(storagePath, formData, { upsert: false, contentType: 'multipart/form-data' });

    if (uploadError) return { error: uploadError.message };

    const { data: { publicUrl } } = supabase.storage
      .from('client-files')
      .getPublicUrl(storagePath);

    const { data: inserted, error: dbError } = await supabase
      .from('progress_photos')
      .insert({ client_id: clientId, coach_id: coachId, file_url: publicUrl, note: note.trim() || null })
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from('client-files').remove([storagePath]);
      return { error: dbError.message };
    }

    setPhotos((prev) => [inserted as ProgressPhoto, ...prev]);
    return { error: null };
  };

  const deletePhoto = async (photo: ProgressPhoto): Promise<{ error: string | null }> => {
    const cleanUrl = photo.file_url.split('?')[0];
    const marker = '/client-files/';
    const idx = cleanUrl.indexOf(marker);
    const storagePath = idx >= 0 ? cleanUrl.slice(idx + marker.length) : null;
    if (storagePath) await supabase.storage.from('client-files').remove([storagePath]);
    const { error } = await supabase.from('progress_photos').delete().eq('id', photo.id);
    if (error) return { error: error.message };
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    return { error: null };
  };

  return { photos, loading, refetch: load, sendPhoto, deletePhoto };
}
