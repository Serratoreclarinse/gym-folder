-- Migration 049: add 'planned' to workout_sessions status check

ALTER TABLE public.workout_sessions
  DROP CONSTRAINT IF EXISTS workout_sessions_status_check;

ALTER TABLE public.workout_sessions
  ADD CONSTRAINT workout_sessions_status_check
  CHECK (status IN ('confirmed', 'pending', 'absent', 'no_show', 'completed', 'planned'));
