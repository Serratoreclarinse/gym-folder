-- ============================================================
-- Migration 016 — Hourly time blocks + admin ID helper
-- ============================================================

-- Add optional hour range to coach_blocked_dates (NULL = full day)
ALTER TABLE public.coach_blocked_dates
  ADD COLUMN IF NOT EXISTS start_time TEXT,
  ADD COLUMN IF NOT EXISTS end_time   TEXT;

-- Helper RPC: returns IDs of all admin users (reads auth.users)
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE(user_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id AS user_id
  FROM   auth.users
  WHERE  raw_app_meta_data->>'role' = 'admin';
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_ids() TO authenticated;
