-- 045_template_set_rows.sql
-- Adds per-set reps/weight data to template exercises.
-- set_rows is a JSONB array of { reps: number|null, weight: string|null },
-- one element per set. Replaces the flat sets/reps/weight columns for new templates.
-- Old templates (set_rows IS NULL or []) fall back to the flat columns at apply time.

ALTER TABLE public.template_exercises
  ADD COLUMN IF NOT EXISTS set_rows jsonb NOT NULL DEFAULT '[]'::jsonb;
