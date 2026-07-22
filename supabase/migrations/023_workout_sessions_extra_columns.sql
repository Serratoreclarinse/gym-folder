-- ============================================================
-- Migration 023 — Add extra columns to workout_sessions
-- ============================================================
-- These columns are used by the log-session screen but were
-- never formally added via migration (previously missing).

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS scheduled_time TEXT,
  ADD COLUMN IF NOT EXISTS session_type   TEXT
    CHECK (session_type IN ('gym', 'home'));
