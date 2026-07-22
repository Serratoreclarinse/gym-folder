import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type SlotInfo = {
  time: string;        // "09:00"
  label: string;       // "9:00 AM"
  isAvailable: boolean;
};

export function useCoachSlots(coachId: string | null) {
  const getSlots = useCallback(async (dateStr: string): Promise<SlotInfo[]> => {
    if (!coachId || !dateStr) return [];

    const { data, error } = await supabase.rpc('get_coach_slots', {
      p_coach_id: coachId,
      p_date: dateStr,
    });

    if (error || !data) return [];

    return (data as { slot_time: string; is_available: boolean }[]).map((row) => {
      const t = row.slot_time.slice(0, 5); // "09:00"
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      return {
        time: t,
        label: `${hour}:${String(m).padStart(2, '0')} ${ampm}`,
        isAvailable: row.is_available,
      };
    });
  }, [coachId]);

  return { getSlots };
}
