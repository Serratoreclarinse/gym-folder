import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type AnnouncementType = 'emergency' | 'holiday' | 'general' | 'promo';
export type AnnouncementTarget = 'all' | 'specific';

export type Announcement = {
  id: string;
  coach_id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  target: AnnouncementTarget;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  recipients: string[]; // client_ids
};

export type NewAnnouncement = {
  title: string;
  message: string;
  type: AnnouncementType;
  target: AnnouncementTarget;
  is_pinned: boolean;
  recipientIds: string[];
};

function sortList(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export function useAnnouncements() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('announcements')
      .select('*, announcement_recipients(client_id)')
      .eq('coach_id', profile.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
    setLoading(false);
    if (!error && data) {
      setAnnouncements(
        (data as any[]).map((a) => ({
          ...a,
          recipients: (a.announcement_recipients ?? []).map((r: any) => r.client_id),
        }))
      );
    }
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  const pinnedAnnouncement = announcements.find((a) => a.is_pinned) ?? null;

  const createAnnouncement = async (
    data: NewAnnouncement,
  ): Promise<{ error: string | null; announcement: Announcement | null }> => {
    if (!profile?.id) return { error: 'Not authenticated', announcement: null };

    const { data: inserted, error } = await supabase
      .from('announcements')
      .insert({
        coach_id: profile.id,
        title: data.title.trim(),
        message: data.message.trim(),
        type: data.type,
        target: data.target,
        is_pinned: data.is_pinned,
      })
      .select()
      .single();

    if (error) return { error: error.message, announcement: null };

    if (data.target === 'specific' && data.recipientIds.length > 0) {
      await supabase.from('announcement_recipients').insert(
        data.recipientIds.map((clientId) => ({
          announcement_id: inserted.id,
          client_id: clientId,
        })),
      );
    }

    const newAnn: Announcement = {
      ...inserted,
      recipients: data.target === 'specific' ? data.recipientIds : [],
    };
    setAnnouncements((prev) => sortList([newAnn, ...prev]));
    return { error: null, announcement: newAnn };
  };

  const updateAnnouncement = async (
    id: string,
    updates: Partial<Pick<Announcement, 'title' | 'message' | 'is_pinned'>>,
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from('announcements')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    setAnnouncements((prev) =>
      sortList(prev.map((a) => (a.id === id ? { ...a, ...updates } : a))),
    );
    return { error: null };
  };

  const deleteAnnouncement = async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) return { error: error.message };
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    return { error: null };
  };

  const togglePin = (id: string, current: boolean) =>
    updateAnnouncement(id, { is_pinned: !current });

  return {
    announcements,
    loading,
    refetch: load,
    pinnedAnnouncement,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    togglePin,
  };
}
