import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type AvailabilityBreak = {
  id: string;
  availability_id: string;
  start_time: string; // HH:MM
  end_time: string;
};

export type DayAvailability = {
  id: string | null; // null = not yet in DB
  day_of_week: number; // 0=Sun … 6=Sat
  start_time: string; // HH:MM 24h
  end_time: string;
  is_active: boolean;
  max_clients: number;
  slot_duration: number; // minutes
  breaks: AvailabilityBreak[];
};

export type BlockedDate = {
  id: string;
  coach_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  reason: string | null;
  created_at: string;
};

const DAY_DEFAULTS: Omit<DayAvailability, 'id' | 'day_of_week'> = {
  start_time: '06:00',
  end_time: '22:00',
  is_active: false,
  max_clients: 1,
  slot_duration: 60,
  breaks: [],
};

export function useAvailability() {
  const { profile } = useAuth();
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return; }
    setLoading(true);

    const [avRes, bdRes] = await Promise.all([
      supabase
        .from('coach_availability')
        .select('*, breaks:availability_breaks(*)')
        .eq('coach_id', profile.id)
        .order('day_of_week'),
      supabase
        .from('blocked_dates')
        .select('*')
        .eq('coach_id', profile.id)
        .order('start_date'),
    ]);

    const dbDays = (avRes.data ?? []) as (DayAvailability & { breaks: AvailabilityBreak[] })[];
    const days: DayAvailability[] = Array.from({ length: 7 }, (_, i) => {
      const found = dbDays.find((d) => d.day_of_week === i);
      return found ?? { id: null, day_of_week: i, ...DAY_DEFAULTS };
    });

    setAvailability(days);
    setBlockedDates(bdRes.data ?? []);
    setLoading(false);
  }, [profile?.id]);

  const saveDay = async (day: DayAvailability) => {
    if (!profile?.id) return;
    // Skip saving an inactive day that was never in the DB
    if (!day.id && !day.is_active) return;

    if (day.id) {
      await supabase.from('coach_availability').update({
        start_time: day.start_time,
        end_time: day.end_time,
        is_active: day.is_active,
        max_clients: day.max_clients,
        slot_duration: day.slot_duration,
        updated_at: new Date().toISOString(),
      }).eq('id', day.id);

      await supabase.from('availability_breaks').delete().eq('availability_id', day.id);
      if (day.breaks.length > 0) {
        await supabase.from('availability_breaks').insert(
          day.breaks.map((b) => ({
            availability_id: day.id,
            start_time: b.start_time,
            end_time: b.end_time,
          })),
        );
      }
    } else {
      const { data, error } = await supabase
        .from('coach_availability')
        .insert({
          coach_id: profile.id,
          day_of_week: day.day_of_week,
          start_time: day.start_time,
          end_time: day.end_time,
          is_active: day.is_active,
          max_clients: day.max_clients,
          slot_duration: day.slot_duration,
        })
        .select()
        .single();

      if (!error && data && day.breaks.length > 0) {
        await supabase.from('availability_breaks').insert(
          day.breaks.map((b) => ({
            availability_id: data.id,
            start_time: b.start_time,
            end_time: b.end_time,
          })),
        );
      }
    }

    await fetchAll();
  };

  const addBlockedDate = async (start: string, end: string, reason?: string) => {
    if (!profile?.id) return;
    await supabase.from('blocked_dates').insert({
      coach_id: profile.id,
      start_date: start,
      end_date: end,
      reason: reason?.trim() || null,
    });
    await fetchAll();
  };

  const removeBlockedDate = async (id: string) => {
    await supabase.from('blocked_dates').delete().eq('id', id);
    await fetchAll();
  };

  const isDateBlocked = (dateStr: string): boolean =>
    blockedDates.some((b) => b.start_date <= dateStr && b.end_date >= dateStr);

  const getTodayInfo = (): { startTime: string; endTime: string; slotMinutes: number } | null => {
    const today = new Date();
    const dow = today.getDay();
    const day = availability.find((d) => d.day_of_week === dow);
    if (!day || !day.is_active) return null;
    if (isDateBlocked(today.toISOString().split('T')[0])) return null;
    return { startTime: day.start_time, endTime: day.end_time, slotMinutes: day.slot_duration };
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return {
    availability,
    blockedDates,
    loading,
    refetch: fetchAll,
    saveDay,
    addBlockedDate,
    removeBlockedDate,
    isDateBlocked,
    getTodayInfo,
  };
}
