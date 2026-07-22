-- ============================================================
-- Migration 021 — Fix workout_sessions RLS + status constraint
-- ============================================================

-- ── Part 1: Fix RLS coach policy ────────────────────────────
-- The original WITH CHECK used an inline EXISTS subquery against
-- packages where auth.uid() fails to resolve correctly in
-- some Supabase/PostgREST versions. Use a SECURITY DEFINER
-- helper function so auth.uid() is evaluated at the call site
-- and the package lookup bypasses packages RLS.

CREATE OR REPLACE FUNCTION public.coach_owns_package(p_package_id UUID, p_coach_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM packages
    WHERE id = p_package_id
      AND coach_id = p_coach_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.coach_owns_package(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "workout_sessions: coach full access" ON public.workout_sessions;

CREATE POLICY "workout_sessions: coach full access"
  ON public.workout_sessions
  FOR ALL
  USING  (coach_id = auth.uid())
  WITH CHECK (
    coach_id = auth.uid()
    AND public.coach_owns_package(package_id, auth.uid())
  );

-- ── Part 2: Expand status CHECK constraint ───────────────────
-- The manually-added status column only allowed
-- ('confirmed', 'pending', 'absent', 'no_show').
-- Add 'completed' so coaches can log finished sessions.

ALTER TABLE public.workout_sessions
  DROP CONSTRAINT IF EXISTS workout_sessions_status_check;

ALTER TABLE public.workout_sessions
  ADD CONSTRAINT workout_sessions_status_check
  CHECK (status IN ('confirmed', 'pending', 'absent', 'no_show', 'completed'));
