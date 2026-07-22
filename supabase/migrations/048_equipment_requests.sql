-- 048_equipment_requests.sql
-- Table for coaches to request gym equipment from admin.
-- Admin can approve, reject, or mark as fulfilled.

CREATE TABLE IF NOT EXISTS public.equipment_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_name   TEXT NOT NULL,
  quantity    INT  NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'fulfilled')),
  admin_notes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eq_req_coach_idx  ON public.equipment_requests (coach_id);
CREATE INDEX IF NOT EXISTS eq_req_status_idx ON public.equipment_requests (status);

ALTER TABLE public.equipment_requests ENABLE ROW LEVEL SECURITY;

-- Coach: full access to their own requests only
DROP POLICY IF EXISTS "eq_req_coach" ON public.equipment_requests;
CREATE POLICY "eq_req_coach"
  ON public.equipment_requests FOR ALL
  USING  (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Admin: full access to all requests
DROP POLICY IF EXISTS "eq_req_admin" ON public.equipment_requests;
CREATE POLICY "eq_req_admin"
  ON public.equipment_requests FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
