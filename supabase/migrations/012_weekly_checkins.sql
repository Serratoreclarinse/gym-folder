-- ============================================================
-- Migration 012 — Weekly check-ins
-- Client fills in weight, mood, sleep, energy, notes weekly.
-- Coach can see their clients' history.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.weekly_checkins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_date      DATE NOT NULL,
  weight_kg      NUMERIC(5,2),
  mood           SMALLINT CHECK (mood BETWEEN 1 AND 5),
  sleep_quality  SMALLINT CHECK (sleep_quality BETWEEN 1 AND 5),
  energy_level   SMALLINT CHECK (energy_level BETWEEN 1 AND 5),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, week_date)
);

CREATE INDEX IF NOT EXISTS weekly_checkins_client_idx ON public.weekly_checkins (client_id, week_date DESC);
CREATE INDEX IF NOT EXISTS weekly_checkins_coach_idx  ON public.weekly_checkins (coach_id);

ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;

-- Client manages their own check-ins
DROP POLICY IF EXISTS "checkins_client_all" ON public.weekly_checkins;
CREATE POLICY "checkins_client_all"
  ON public.weekly_checkins
  FOR ALL
  USING  (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- Coach reads check-ins of their clients
DROP POLICY IF EXISTS "checkins_coach_select" ON public.weekly_checkins;
CREATE POLICY "checkins_coach_select"
  ON public.weekly_checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.packages p
      WHERE p.client_id = weekly_checkins.client_id
        AND p.coach_id  = auth.uid()
    )
  );

-- Admin reads all
DROP POLICY IF EXISTS "checkins_admin_select" ON public.weekly_checkins;
CREATE POLICY "checkins_admin_select"
  ON public.weekly_checkins
  FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
