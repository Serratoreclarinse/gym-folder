import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type WeeklyCheckin = {
  id: string;
  client_id: string;
  coach_id: string;
  week_date: string;
  weight_kg: number | null;
  mood: number | null;
  sleep_quality: number | null;
  energy_level: number | null;
  notes: string | null;
  created_at: string;
};

export type CheckinInput = {
  weight_kg: string;
  mood: number;
  sleep_quality: number;
  energy_level: number;
  notes: string;
};

// Monday of the current week (ISO date string)
export function thisWeekMonday(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

// ── Client: own check-ins ────────────────────────────────────────────────────
export function useMyCheckins(clientId: string | null, coachId: string | null) {
  const [checkins, setCheckins] = useState<WeeklyCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('weekly_checkins')
      .select('*')
      .eq('client_id', clientId)
      .order('week_date', { ascending: false });
    setLoading(false);
    setCheckins((data as WeeklyCheckin[]) ?? []);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const upsert = async (input: CheckinInput): Promise<{ error: string | null }> => {
    if (!clientId) return { error: 'Not authenticated' };
    let resolvedCoachId = coachId;
    if (!resolvedCoachId) {
      const { data } = await supabase
        .from('packages')
        .select('coach_id')
        .eq('client_id', clientId)
        .eq('status', 'active')
        .single();
      resolvedCoachId = data?.coach_id ?? null;
    }
    if (!resolvedCoachId) return { error: 'No active coaching package found' };
    const week_date = thisWeekMonday();
    const payload = {
      client_id: clientId,
      coach_id: resolvedCoachId,
      week_date,
      weight_kg: input.weight_kg ? Number(input.weight_kg) : null,
      mood: input.mood,
      sleep_quality: input.sleep_quality,
      energy_level: input.energy_level,
      notes: input.notes.trim() || null,
    };
    const { data, error } = await supabase
      .from('weekly_checkins')
      .upsert(payload, { onConflict: 'client_id,week_date' })
      .select()
      .single();
    if (error) return { error: error.message };
    setCheckins((prev) => {
      const idx = prev.findIndex((c) => c.week_date === week_date);
      if (idx >= 0) { const next = [...prev]; next[idx] = data as WeeklyCheckin; return next; }
      return [data as WeeklyCheckin, ...prev];
    });
    return { error: null };
  };

  const thisWeek = checkins.find((c) => c.week_date === thisWeekMonday()) ?? null;
  return { checkins, loading, refetch: load, upsert, thisWeek };
}

// ── Coach: client's check-ins ────────────────────────────────────────────────
export function useClientCheckins(clientId: string) {
  const [checkins, setCheckins] = useState<WeeklyCheckin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from('weekly_checkins')
      .select('*')
      .eq('client_id', clientId)
      .order('week_date', { ascending: false });
    setLoading(false);
    setCheckins((data as WeeklyCheckin[]) ?? []);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  return { checkins, loading, refetch: load };
}
