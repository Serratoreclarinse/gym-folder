-- Allow clients to SELECT their own renewal records
-- (coach and admin policies already exist in 027; client was missing)

DROP POLICY IF EXISTS "renewal_requests: client select" ON public.renewal_requests;
CREATE POLICY "renewal_requests: client select"
  ON public.renewal_requests FOR SELECT
  USING (
    client_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'client'
    )
  );
