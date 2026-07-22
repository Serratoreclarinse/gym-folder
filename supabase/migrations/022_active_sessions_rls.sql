-- ============================================================
-- Migration 022 — RLS for active_sessions table
-- ============================================================
-- active_sessions was added to the live DB outside migrations.
-- This migration adds RLS so clients can read their own session.

ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "active_sessions: coach full access" ON public.active_sessions;
CREATE POLICY "active_sessions: coach full access"
  ON public.active_sessions
  FOR ALL
  USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "active_sessions: client read own" ON public.active_sessions;
CREATE POLICY "active_sessions: client read own"
  ON public.active_sessions
  FOR SELECT
  USING (client_id = auth.uid());
