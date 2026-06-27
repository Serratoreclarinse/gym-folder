import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type NoteCategory = 'general' | 'goal' | 'injury' | 'preference' | 'behavior';

export type CoachNote = {
  id: string;
  coach_id: string;
  client_id: string;
  note_text: string;
  category: NoteCategory;
  is_pinned: boolean;
  date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
};

export type NewNote = Omit<CoachNote, 'id' | 'coach_id' | 'created_at' | 'updated_at'>;

export function useNotes(clientId: string) {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!profile?.id || !clientId) { setLoading(false); return; }
    setLoading(true);

    const { data } = await supabase
      .from('coach_notes')
      .select('*')
      .eq('client_id', clientId)
      .eq('coach_id', profile.id)
      .order('is_pinned', { ascending: false })
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    setNotes(data ?? []);
    setLoading(false);
  }, [profile?.id, clientId]);

  const addNote = async (note: NewNote) => {
    if (!profile?.id) return;
    await supabase.from('coach_notes').insert({ ...note, coach_id: profile.id });
    await fetchNotes();
  };

  const updateNote = async (id: string, data: Partial<NewNote>) => {
    await supabase
      .from('coach_notes')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id);
    await fetchNotes();
  };

  const deleteNote = async (id: string) => {
    await supabase.from('coach_notes').delete().eq('id', id);
    await fetchNotes();
  };

  const togglePin = async (id: string, current: boolean) => {
    await supabase
      .from('coach_notes')
      .update({ is_pinned: !current, updated_at: new Date().toISOString() })
      .eq('id', id);
    await fetchNotes();
  };

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  return { notes, loading, refetch: fetchNotes, addNote, updateNote, deleteNote, togglePin };
}
