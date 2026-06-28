import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type ActiveSession = {
  id: string;
  coach_id: string;
  client_id: string;
  client_name: string;
  session_id: string;
  start_time: string;
  original_duration: number;
  current_duration: number;
  is_active: boolean;
  is_paused: boolean;
  pause_started_at: string | null;
};

export type SessionExtension = {
  id: string;
  session_id: string;
  active_session_id: string;
  extended_at: string;
  minutes_added: number;
  reason: string | null;
};

export type NextSession = {
  id: string;
  client_id: string;
  client_name: string;
  scheduled_at: string;
  notes: string | null;
};

export function useActiveSession() {
  const { profile } = useAuth();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [extensions, setExtensions] = useState<SessionExtension[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data: aData } = await supabase
      .from('active_sessions')
      .select('id, coach_id, client_id, session_id, start_time, original_duration, current_duration, is_active, is_paused, pause_started_at')
      .eq('coach_id', profile.id)
      .eq('is_active', true)
      .maybeSingle();

    if (aData) {
      const { data: clientData } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', aData.client_id)
        .single();

      setActiveSession({
        ...aData,
        client_name: clientData?.name ?? 'Client',
        is_paused: aData.is_paused ?? false,
        pause_started_at: aData.pause_started_at ?? null,
      });

      const { data: extData } = await supabase
        .from('session_extensions')
        .select('*')
        .eq('active_session_id', aData.id)
        .order('extended_at', { ascending: true });
      setExtensions((extData as SessionExtension[]) ?? []);
    } else {
      setActiveSession(null);
      setExtensions([]);
    }

    const { data: nsData } = await supabase
      .from('scheduled_sessions')
      .select('id, client_id, scheduled_at, notes')
      .eq('coach_id', profile.id)
      .gt('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nsData) {
      const { data: nsClient } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', nsData.client_id)
        .single();
      setNextSession({
        id: nsData.id,
        client_id: nsData.client_id,
        client_name: nsClient?.name ?? 'Client',
        scheduled_at: nsData.scheduled_at,
        notes: nsData.notes,
      });
    } else {
      setNextSession(null);
    }

    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  const extendSession = async (
    minutesAdded: number,
    reason: string,
  ): Promise<{ error: string | null }> => {
    if (!activeSession) return { error: 'No active session' };
    const newDuration = activeSession.current_duration + minutesAdded;

    const [updateRes, insertRes] = await Promise.all([
      supabase
        .from('active_sessions')
        .update({ current_duration: newDuration })
        .eq('id', activeSession.id),
      supabase.from('session_extensions').insert({
        session_id: activeSession.session_id,
        active_session_id: activeSession.id,
        extended_at: new Date().toISOString(),
        minutes_added: minutesAdded,
        reason: reason.trim() || null,
      }),
    ]);

    if (updateRes.error) return { error: updateRes.error.message };
    if (insertRes.error) return { error: insertRes.error.message };

    setActiveSession((prev) => prev ? { ...prev, current_duration: newDuration } : null);
    setExtensions((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        session_id: activeSession.session_id,
        active_session_id: activeSession.id,
        extended_at: new Date().toISOString(),
        minutes_added: minutesAdded,
        reason: reason.trim() || null,
      },
    ]);
    return { error: null };
  };

  const pauseSession = async (): Promise<{ error: string | null }> => {
    if (!activeSession) return { error: 'No active session' };
    const { error } = await supabase
      .from('active_sessions')
      .update({ is_paused: true, pause_started_at: new Date().toISOString() })
      .eq('id', activeSession.id);
    if (error) return { error: error.message };
    setActiveSession((prev) => prev ? { ...prev, is_paused: true, pause_started_at: new Date().toISOString() } : null);
    return { error: null };
  };

  const resumeSession = async (): Promise<{ error: string | null }> => {
    if (!activeSession || !activeSession.pause_started_at) return { error: 'Not paused' };
    const pausedMins = Math.ceil((Date.now() - new Date(activeSession.pause_started_at).getTime()) / 60000);
    const newDuration = activeSession.current_duration + Math.max(1, pausedMins);
    const { error } = await supabase
      .from('active_sessions')
      .update({ is_paused: false, pause_started_at: null, current_duration: newDuration })
      .eq('id', activeSession.id);
    if (error) return { error: error.message };
    setActiveSession((prev) => prev ? { ...prev, is_paused: false, pause_started_at: null, current_duration: newDuration } : null);
    return { error: null };
  };

  const endSession = async (): Promise<{ error: string | null }> => {
    if (!activeSession) return { error: 'No active session' };
    const { error } = await supabase
      .from('active_sessions')
      .update({ is_active: false })
      .eq('id', activeSession.id);
    if (error) return { error: error.message };
    setActiveSession(null);
    setExtensions([]);
    return { error: null };
  };

  return { activeSession, nextSession, extensions, loading, refetch: load, extendSession, endSession, pauseSession, resumeSession };
}
