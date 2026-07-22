-- Fix renewal_requests RLS: use profiles table for role check instead of JWT app_metadata
-- (app_metadata may not be set for all coach accounts)

DROP POLICY IF EXISTS "renewal_requests: coach insert" ON public.renewal_requests;
CREATE POLICY "renewal_requests: coach insert"
  ON public.renewal_requests FOR INSERT
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'coach'
        AND deactivated_at IS NULL
    )
  );

DROP POLICY IF EXISTS "renewal_requests: coach select" ON public.renewal_requests;
CREATE POLICY "renewal_requests: coach select"
  ON public.renewal_requests FOR SELECT
  USING (
    coach_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'coach'
    )
  );

DROP POLICY IF EXISTS "renewal_requests: admin select" ON public.renewal_requests;
CREATE POLICY "renewal_requests: admin select"
  ON public.renewal_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "renewal_requests: admin update" ON public.renewal_requests;
CREATE POLICY "renewal_requests: admin update"
  ON public.renewal_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );
