-- ============================================================
-- Migration 008 — Admin RPC functions + duration_weeks + auto-expiry
-- ============================================================

-- ── 1. Add duration_weeks to packages ───────────────────────
-- Already used in app code; column must exist in the DB.
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS duration_weeks INTEGER CHECK (duration_weeks > 0);

-- ── 2. admin_update_profile ─────────────────────────────────
-- Admin updates a user's name + phone. SECURITY DEFINER bypasses
-- RLS so admin can touch any profile row.
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user_id UUID,
  p_name    TEXT,
  p_phone   TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET name  = TRIM(p_name),
      phone = NULLIF(TRIM(p_phone), '')
  WHERE id = p_user_id;
END;
$$;

-- ── 3. admin_deactivate_package ─────────────────────────────
-- Marks a package as expired immediately (manual override).
CREATE OR REPLACE FUNCTION public.admin_deactivate_package(
  p_package_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.packages
  SET status = 'expired'
  WHERE id = p_package_id;
END;
$$;

-- ── 4. admin_add_sessions ────────────────────────────────────
-- Adds N sessions to an existing package and re-activates it
-- if it was expired.
CREATE OR REPLACE FUNCTION public.admin_add_sessions(
  p_package_id      UUID,
  p_sessions_to_add INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.packages
  SET total_sessions = total_sessions + p_sessions_to_add,
      status         = 'active'   -- re-activate if previously expired
  WHERE id = p_package_id;
END;
$$;

-- ── 5. Auto-expiry by date (pg_cron) ────────────────────────
-- Requires the pg_cron extension. Enable it first:
--   Supabase dashboard → Database → Extensions → search "pg_cron" → Enable
--
-- This job runs at midnight UTC every day and expires any active package
-- whose start_date + duration_weeks has passed.
--
-- If pg_cron is not enabled, comment out the SELECT cron.schedule(...) line
-- and run it manually after enabling the extension.

CREATE OR REPLACE FUNCTION public.expire_packages_by_duration()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.packages
  SET status = 'expired'
  WHERE status         = 'active'
    AND duration_weeks IS NOT NULL
    AND (start_date + (duration_weeks * INTERVAL '1 week')) < CURRENT_DATE;
END;
$$;

-- Schedule the job (runs once daily at 00:00 UTC).
-- Uncomment after enabling pg_cron in Supabase dashboard:
--
-- SELECT cron.schedule(
--   'auto-expire-packages-by-duration',
--   '0 0 * * *',
--   $$ SELECT public.expire_packages_by_duration(); $$
-- );
