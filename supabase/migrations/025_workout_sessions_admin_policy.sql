-- ============================================================
-- Migration 025 — Admin read access to workout_sessions
-- ============================================================
-- Migration 021 added a coach-only RLS policy. Admin has no
-- SELECT policy so reading another coach's sessions returns
-- nothing on the admin coach profile page.

DROP POLICY IF EXISTS "workout_sessions: admin select" ON public.workout_sessions;
CREATE POLICY "workout_sessions: admin select"
  ON public.workout_sessions
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
