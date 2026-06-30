import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendPushNotification } from '@/lib/pushNotifications';

export type BookingRequest = {
  id: string;
  client_id: string;
  coach_id: string;
  package_id: string | null;
  type: 'booking' | 'renewal';
  preferred_date: string | null;
  preferred_time: string | null;
  notes: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  client_name?: string;
};

// ── Client side ────────────────────────────────────────────────
export function useClientBookingRequests(coachId: string | null, packageId: string | null) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<BookingRequest[]>([]);

  const refetch = useCallback(async () => {
    if (!user?.id || !coachId) return;
    const { data } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setRequests((data ?? []) as BookingRequest[]);
  }, [user?.id, coachId]);

  useEffect(() => { refetch(); }, [refetch]);

  const submitRequest = async (params: {
    type: 'booking' | 'renewal';
    preferred_date?: string;
    preferred_time?: string;
    notes?: string;
  }): Promise<{ error: string | null }> => {
    if (!user?.id || !coachId) return { error: 'Not authenticated' };
    const { error } = await supabase.from('booking_requests').insert({
      client_id: user.id,
      coach_id: coachId,
      package_id: packageId,
      type: params.type,
      preferred_date: params.preferred_date ?? null,
      preferred_time: params.preferred_time ?? null,
      notes: params.notes?.trim() || null,
    });
    if (!error) await refetch();
    return { error: error?.message ?? null };
  };

  return { requests, refetch, submitRequest };
}

// ── Coach side ─────────────────────────────────────────────────
export function useCoachBookingRequests() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('booking_requests')
      .select(`*, client:profiles!booking_requests_client_id_fkey ( name )`)
      .eq('coach_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setRequests(
      (data ?? []).map((r: any) => ({ ...r, client_name: r.client?.name ?? 'Client' })),
    );
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { refetch(); }, [refetch]);

  const respond = async (id: string, status: 'accepted' | 'declined'): Promise<void> => {
    const target = requests.find((r) => r.id === id);
    await supabase.from('booking_requests').update({ status }).eq('id', id);
    if (target) {
      const isBooking = target.type === 'booking';
      if (status === 'accepted') {
        await sendPushNotification(target.client_id, {
          title: isBooking ? '✅ Session Request Accepted' : '✅ Renewal Request Accepted',
          body: isBooking
            ? 'Your coach accepted your session request. Check your schedule for the details.'
            : 'Your coach accepted your renewal request. Your package will be updated soon.',
        });
      } else {
        await sendPushNotification(target.client_id, {
          title: isBooking ? '❌ Session Request Declined' : '❌ Renewal Request Declined',
          body: 'Your coach could not accommodate your request. Try requesting a different date or time.',
        });
      }
    }
    await refetch();
  };

  return { requests, loading, refetch, respond };
}
