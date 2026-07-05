-- ============================================================
-- Migration 009 — Body measurements tracker
-- ============================================================

CREATE TABLE IF NOT EXISTS public.body_measurements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logged_at      DATE        NOT NULL DEFAULT CURRENT_DATE,
  weight_kg      NUMERIC(5,2),
  body_fat_pct   NUMERIC(4,1),
  muscle_mass_kg NUMERIC(5,2),
  chest_cm       NUMERIC(5,1),
  waist_cm       NUMERIC(5,1),
  hips_cm        NUMERIC(5,1),
  arms_cm        NUMERIC(5,1),
  thighs_cm      NUMERIC(5,1),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (client_id, logged_at)
);

CREATE INDEX IF NOT EXISTS body_measurements_client_date_idx
  ON public.body_measurements (client_id, logged_at DESC);

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

-- Client manages their own entries
CREATE POLICY "body_measurements_client"
  ON public.body_measurements
  FOR ALL
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Coach reads measurements for their own clients
CREATE POLICY "body_measurements_coach_select"
  ON public.body_measurements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.packages p
      WHERE p.client_id = body_measurements.client_id
        AND p.coach_id  = auth.uid()
    )
  );

-- Admin reads all
CREATE POLICY "body_measurements_admin_select"
  ON public.body_measurements
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
