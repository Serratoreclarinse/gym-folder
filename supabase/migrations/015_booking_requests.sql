-- ============================================================
-- Migration 015 — Client booking requests
-- ============================================================

CREATE TABLE IF NOT EXISTS public.booking_requests (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package_id     UUID        REFERENCES public.packages(id) ON DELETE SET NULL,
  type           TEXT        NOT NULL CHECK (type IN ('booking', 'renewal')),
  preferred_date DATE,
  preferred_time TEXT,
  notes          TEXT,
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS booking_requests_coach_idx
  ON public.booking_requests (coach_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS booking_requests_client_idx
  ON public.booking_requests (client_id, created_at DESC);

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

-- Client can insert and read their own requests
DROP POLICY IF EXISTS "booking_requests_client" ON public.booking_requests;
CREATE POLICY "booking_requests_client"
  ON public.booking_requests
  FOR ALL
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Coach can read and update requests assigned to them
DROP POLICY IF EXISTS "booking_requests_coach_select" ON public.booking_requests;
CREATE POLICY "booking_requests_coach_select"
  ON public.booking_requests
  FOR SELECT
  USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "booking_requests_coach_update" ON public.booking_requests;
CREATE POLICY "booking_requests_coach_update"
  ON public.booking_requests
  FOR UPDATE
  USING  (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Admin can see all
DROP POLICY IF EXISTS "booking_requests_admin" ON public.booking_requests;
CREATE POLICY "booking_requests_admin"
  ON public.booking_requests
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
