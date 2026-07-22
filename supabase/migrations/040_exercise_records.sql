-- 040_exercise_records.sql
-- Stores per-exercise personal records for each client.
-- One row per (client, exercise_name, session) — updated each session.
-- Best values across all sessions = query MAX per client+exercise.

CREATE TABLE IF NOT EXISTS public.exercise_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id       UUID        REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
  exercise_name    TEXT        NOT NULL,
  best_kg          NUMERIC,        -- heaviest single set (NULL for bodyweight)
  best_reps        INTEGER,        -- most reps in a single set
  best_duration    INTEGER,        -- longest hold in seconds (planks, etc.)
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookups by client + exercise for PR comparisons
CREATE INDEX IF NOT EXISTS exercise_records_client_exercise_idx
  ON public.exercise_records (client_id, exercise_name, recorded_at DESC);

-- RLS
ALTER TABLE public.exercise_records ENABLE ROW LEVEL SECURITY;

-- Coach can insert records for their own clients (relationship via packages)
CREATE POLICY "exercise_records: coach inserts for own clients"
  ON public.exercise_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.packages
      WHERE packages.client_id = exercise_records.client_id
        AND packages.coach_id = auth.uid()
    )
  );

-- Coach can read records for their own clients
CREATE POLICY "exercise_records: coach reads own clients"
  ON public.exercise_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.packages
      WHERE packages.client_id = exercise_records.client_id
        AND packages.coach_id = auth.uid()
    )
  );

-- Client can read their own records
CREATE POLICY "exercise_records: client reads own"
  ON public.exercise_records FOR SELECT
  USING (client_id = auth.uid());

-- Admin reads all
CREATE POLICY "exercise_records: admin reads all"
  ON public.exercise_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
