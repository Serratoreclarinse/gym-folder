import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type SetRow = {
  reps: number | null;
  weight: string | null;
};

export type TemplateExercise = {
  id: string;
  template_id: string;
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight: string | null;
  notes: string | null;
  order_index: number;
  set_rows: SetRow[];
};

export type Template = {
  id: string;
  coach_id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  exercises: TemplateExercise[];
};

export type NewTemplateExercise = Omit<TemplateExercise, 'id' | 'template_id'>;

export function useTemplates() {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    if (!profile?.id) { setLoading(false); return; }
    setLoading(true);

    const { data } = await supabase
      .from('session_templates')
      .select(`
        id, coach_id, name, created_at, last_used_at,
        exercises:template_exercises(id, template_id, exercise_name, sets, reps, weight, notes, order_index, set_rows)
      `)
      .eq('coach_id', profile.id)
      .order('last_used_at', { ascending: false, nullsFirst: false });

    setTemplates(
      (data ?? []).map((t) => ({
        id: t.id,
        coach_id: t.coach_id,
        name: t.name,
        created_at: t.created_at,
        last_used_at: t.last_used_at,
        exercises: ((t.exercises as any[]) ?? [])
          .sort((a, b) => a.order_index - b.order_index)
          .map((e) => ({
            ...e,
            set_rows: (e.set_rows as SetRow[] | null) ?? [],
          })),
      }))
    );
    setLoading(false);
  }, [profile?.id]);

  const createTemplate = async (name: string, exercises: NewTemplateExercise[]): Promise<string | null> => {
    if (!profile?.id) return null;

    const { data: tpl, error } = await supabase
      .from('session_templates')
      .insert({ name, coach_id: profile.id })
      .select('id')
      .single();

    if (error || !tpl) return null;

    if (exercises.length > 0) {
      await supabase.from('template_exercises').insert(
        exercises.map((e, i) => ({ ...e, template_id: tpl.id, order_index: i }))
      );
    }

    await fetchTemplates();
    return tpl.id;
  };

  const updateTemplate = async (id: string, name: string, exercises: NewTemplateExercise[]) => {
    await supabase.from('session_templates').update({ name }).eq('id', id);
    await supabase.from('template_exercises').delete().eq('template_id', id);
    if (exercises.length > 0) {
      await supabase.from('template_exercises').insert(
        exercises.map((e, i) => ({ ...e, template_id: id, order_index: i }))
      );
    }
    await fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from('template_exercises').delete().eq('template_id', id);
    await supabase.from('session_templates').delete().eq('id', id);
    await fetchTemplates();
  };

  const duplicateTemplate = async (template: Template) => {
    await createTemplate(
      `${template.name} (Copy)`,
      template.exercises.map((e) => ({
        exercise_name: e.exercise_name,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        notes: e.notes,
        order_index: e.order_index,
        set_rows: e.set_rows,
      }))
    );
  };

  const markUsed = async (id: string) => {
    await supabase
      .from('session_templates')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', id);
  };

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  return {
    templates,
    loading,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    markUsed,
  };
}
