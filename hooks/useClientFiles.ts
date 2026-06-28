import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type FileCategory = 'inbody' | 'progress' | 'document';

export type ClientFile = {
  id: string;
  client_id: string;
  coach_id: string;
  file_url: string;
  file_type: 'image' | 'pdf' | 'link';
  category: FileCategory;
  label: string | null;
  description: string | null;
  date: string;
  created_at: string;
};

export function useClientFiles(clientId: string) {
  const { profile } = useAuth();
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id || !clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('client_files')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', profile.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    setLoading(false);
    if (!error && data) setFiles(data as ClientFile[]);
  }, [clientId, profile?.id]);

  useEffect(() => { load(); }, [load]);

  const uploadFile = async (
    uri: string,
    category: FileCategory,
    label: string,
    description: string,
    date: string,
  ): Promise<{ error: string | null }> => {
    if (!profile?.id) return { error: 'Not authenticated' };

    const rawExt = uri.split('.').pop()?.toLowerCase()?.split('?')[0] ?? 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'].includes(rawExt) ? rawExt : 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
    const storagePath = `${profile.id}/${clientId}/${fileName}`;

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
      .from('client_files')
      .insert({
        client_id: clientId,
        coach_id: profile.id,
        file_url: publicUrl,
        file_type: 'image',
        category,
        label: label.trim() || null,
        description: description.trim() || null,
        date,
      })
      .select()
      .single();

    if (dbError) {
      await supabase.storage.from('client-files').remove([storagePath]);
      return { error: dbError.message };
    }

    setFiles((prev) => [inserted as ClientFile, ...prev]);
    return { error: null };
  };

  const deleteFile = async (file: ClientFile): Promise<{ error: string | null }> => {
    const cleanUrl = file.file_url.split('?')[0];
    const marker = '/client-files/';
    const idx = cleanUrl.indexOf(marker);
    const storagePath = idx >= 0 ? cleanUrl.slice(idx + marker.length) : null;

    if (storagePath) {
      await supabase.storage.from('client-files').remove([storagePath]);
    }

    const { error } = await supabase.from('client_files').delete().eq('id', file.id);
    if (error) return { error: error.message };

    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    return { error: null };
  };

  return { files, loading, refetch: load, uploadFile, deleteFile };
}

// Standalone — saves an InBody (or any web) result URL directly, no file upload needed.
export async function saveInBodyLink(
  clientId: string,
  coachId: string,
  url: string,
  label: string,
  date: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('client_files').insert({
    client_id: clientId,
    coach_id: coachId,
    file_url: url,
    file_type: 'link',
    category: 'inbody',
    label: label.trim() || 'InBody Result',
    description: null,
    date,
  });
  return { error: error?.message ?? null };
}
