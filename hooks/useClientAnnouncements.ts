import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { AnnouncementType } from './useAnnouncements';

export type ClientAnnouncement = {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  is_pinned: boolean;
  created_at: string;
};

export function useClientAnnouncements(coachId: string | null) {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<ClientAnnouncement[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!coachId || !user?.id) return;
    setLoading(true);

    // Fetch 'all' announcements from the coach
    const { data: allAnn } = await supabase
      .from('announcements')
      .select('id, title, message, type, is_pinned, created_at')
      .eq('coach_id', coachId)
      .eq('target', 'all')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch 'specific' announcements where this client is a recipient
    const { data: recipientRows } = await supabase
      .from('announcement_recipients')
      .select('announcement:announcements!inner(id, title, message, type, is_pinned, created_at, coach_id)')
      .eq('client_id', user.id);

    const specificAnn: ClientAnnouncement[] = (recipientRows ?? [])
      .map((r: any) => r.announcement)
      .filter((a: any) => a && a.coach_id === coachId)
      .map((a: any) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        type: a.type,
        is_pinned: a.is_pinned,
        created_at: a.created_at,
      }));

    const merged: ClientAnnouncement[] = [
      ...(allAnn ?? []) as ClientAnnouncement[],
      ...specificAnn,
    ];

    // Deduplicate by id, sort pinned first then newest
    const seen = new Set<string>();
    const deduped = merged.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
    deduped.sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setAnnouncements(deduped);
    setLoading(false);
  }, [coachId, user?.id]);

  useEffect(() => { load(); }, [load]);

  return { announcements, loading, refetch: load };
}
