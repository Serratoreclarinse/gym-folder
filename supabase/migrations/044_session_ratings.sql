-- 044_session_ratings.sql
-- Stores client star ratings (1-5) for completed sessions.
-- Client submits once per session; coach can read ratings for their sessions.

CREATE TABLE IF NOT EXISTS public.session_ratings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, client_id)
);

ALTER TABLE public.session_ratings ENABLE ROW LEVEL SECURITY;

-- Client can insert their own rating
DROP POLICY IF EXISTS "session_ratings: client insert" ON public.session_ratings;
CREATE POLICY "session_ratings: client insert"
  ON public.session_ratings FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Client can read their own ratings
DROP POLICY IF EXISTS "session_ratings: client select" ON public.session_ratings;
CREATE POLICY "session_ratings: client select"
  ON public.session_ratings FOR SELECT TO authenticated
  USING (client_id = auth.uid());

-- Coach can read ratings for their sessions
DROP POLICY IF EXISTS "session_ratings: coach select" ON public.session_ratings;
CREATE POLICY "session_ratings: coach select"
  ON public.session_ratings FOR SELECT TO authenticated
  USING (coach_id = auth.uid());
