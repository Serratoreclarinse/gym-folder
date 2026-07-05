import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type BodyMeasurement = {
  id: string;
  client_id: string;
  logged_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  arms_cm: number | null;
  thighs_cm: number | null;
  notes: string | null;
  created_at: string;
};

export type NewMeasurement = Omit<BodyMeasurement, 'id' | 'created_at'>;

// Client: manage their own measurements
export function useMyMeasurements(clientId: string | undefined) {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('client_id', clientId)
      .order('logged_at', { ascending: false })
      .limit(90);
    setLoading(false);
    if (data) setMeasurements(data as BodyMeasurement[]);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const upsert = async (entry: Omit<NewMeasurement, 'client_id'>): Promise<string | null> => {
    if (!clientId) return 'Not authenticated';
    const { error } = await supabase
      .from('body_measurements')
      .upsert({ ...entry, client_id: clientId }, { onConflict: 'client_id,logged_at' });
    if (error) return error.message;
    await load();
    return null;
  };

  const remove = async (id: string): Promise<string | null> => {
    const { error } = await supabase.from('body_measurements').delete().eq('id', id);
    if (error) return error.message;
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    return null;
  };

  return { measurements, loading, refetch: load, upsert, remove };
}

// Coach: read a specific client's measurements
export function useClientMeasurements(clientId: string | undefined) {
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data } = await supabase
      .from('body_measurements')
      .select('*')
      .eq('client_id', clientId)
      .order('logged_at', { ascending: false })
      .limit(90);
    setLoading(false);
    if (data) setMeasurements(data as BodyMeasurement[]);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  return { measurements, loading, refetch: load };
}
