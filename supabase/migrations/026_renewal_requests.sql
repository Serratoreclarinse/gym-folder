-- renewal_requests: coach-initiated package renewal, pending admin approval
CREATE TABLE IF NOT EXISTS public.renewal_requests (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id        UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_type    TEXT    NOT NULL CHECK (package_type IN ('30min', '45min', '1hr')),
  total_sessions  INT     NOT NULL,
  duration_weeks  INT,
  status          TEXT    NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'rejected')),
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.renewal_requests ENABLE ROW LEVEL SECURITY;

-- Coach: insert and read own requests
DROP POLICY IF EXISTS "renewal_requests: coach insert" ON public.renewal_requests;
CREATE POLICY "renewal_requests: coach insert"
  ON public.renewal_requests FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'coach'
    AND coach_id = auth.uid()
  );

DROP POLICY IF EXISTS "renewal_requests: coach select" ON public.renewal_requests;
CREATE POLICY "renewal_requests: coach select"
  ON public.renewal_requests FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'coach'
    AND coach_id = auth.uid()
  );

-- Admin: read all, update status
DROP POLICY IF EXISTS "renewal_requests: admin select" ON public.renewal_requests;
CREATE POLICY "renewal_requests: admin select"
  ON public.renewal_requests FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "renewal_requests: admin update" ON public.renewal_requests;
CREATE POLICY "renewal_requests: admin update"
  ON public.renewal_requests FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- is_retention: marks clients who have renewed at least once
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_retention BOOLEAN NOT NULL DEFAULT false;
