-- ============================================================
-- Migration 024 — Admin read access to coach_availability
-- ============================================================
-- The coach_availability table was created without an admin
-- SELECT policy, so admins get an empty result when reading
-- another coach's schedule. This adds the missing policy.

ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_availability: admin select" ON public.coach_availability;
CREATE POLICY "coach_availability: admin select"
  ON public.coach_availability
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
