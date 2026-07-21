-- 041_client_reads_coach_profile.sql
-- Allow clients to read their coach's profile row.
-- Without this, the packages → profiles join in useClientData returns null
-- for the coach object, so chat header shows "Coach" instead of the real name.

DROP POLICY IF EXISTS "profiles: client reads own coach" ON public.profiles;
CREATE POLICY "profiles: client reads own coach"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.packages
      WHERE packages.coach_id  = profiles.id
        AND packages.client_id = auth.uid()
    )
  );
