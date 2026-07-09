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

// ── Helpers ────────────────────────────────────────────────────
function parseTime(time: string): string {
  const t24 = time.match(/^(\d{1,2}):(\d{2})$/);
  if (t24) return `${t24[1].padStart(2, '0')}:${t24[2]}`;
  const t12 = time.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (t12) {
    let h = parseInt(t12[1], 10);
    const min = t12[2] ?? '00';
    if (/pm/i.test(t12[3]) && h !== 12) h += 12;
    if (/am/i.test(t12[3]) && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${min}`;
  }
  return '09:00';
}

function buildScheduledAt(date: string, time: string | null): string | null {
  if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return null;
  const timeStr = time ? parseTime(time.trim()) : '09:00';
  return `${date}T${timeStr}:00`;
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

      // Auto-create a scheduled session when a booking request is accepted with a preferred date
      if (status === 'accepted' && isBooking && target.preferred_date) {
        const scheduledAt = buildScheduledAt(target.preferred_date, target.preferred_time);
        if (scheduledAt) {
          await supabase.from('scheduled_sessions').insert({
            coach_id: target.coach_id,
            client_id: target.client_id,
            scheduled_at: scheduledAt,
            notes: target.notes ?? null,
            duration_minutes: 60,
          });
        }
      }

      const scheduledDateStr = (status === 'accepted' && isBooking && target.preferred_date)
        ? ` on ${new Date(target.preferred_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
          + (target.preferred_time ? ` at ${target.preferred_time}` : '')
        : '';

      if (status === 'accepted') {
        await sendPushNotification(target.client_id, {
          title: isBooking ? '✅ Session Request Accepted' : '✅ Renewal Request Accepted',
          body: isBooking
            ? `Your coach confirmed your session${scheduledDateStr}. Check your schedule!`
            : 'Your coach accepted your renewal request. Your package will be updated soon.',
        });

        // On renewal acceptance, alert all admins to create a new package
        if (!isBooking) {
          const { data: admins } = await supabase.rpc('get_admin_user_ids');
          if (admins && (admins as { user_id: string }[]).length > 0) {
            const clientName = target.client_name ?? 'A client';
            await Promise.all(
              (admins as { user_id: string }[]).map((row) =>
                sendPushNotification(row.user_id, {
                  title: '📦 Package Renewal Needed',
                  body: `${clientName} needs a new package. Please create one from the admin panel.`,
                })
              )
            );
          }
        }
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
