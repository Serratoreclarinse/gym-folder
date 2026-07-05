-- ============================================================
-- Migration 011 — Move admin role check to app_metadata
-- ============================================================
-- SECURITY FIX: user_metadata is writable by the client via
-- supabase.auth.updateUser(). app_metadata is server-side only.
-- Any user could previously set user_metadata.role = 'admin'
-- and bypass admin-only RLS policies.
-- ============================================================

-- ── 1. Set admin user's app_metadata ────────────────────────
-- This marks the admin account at the DB level (server-only).
-- The admin must sign out and back in for the new JWT to apply.
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'hr@jhe-group.com';

-- ── 2. Fix push_tokens admin policy ─────────────────────────
DROP POLICY IF EXISTS "push_tokens_admin_select" ON public.push_tokens;
CREATE POLICY "push_tokens_admin_select"
  ON public.push_tokens
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 3. Fix client_files admin policy ────────────────────────
DROP POLICY IF EXISTS "client_files_admin_select" ON public.client_files;
CREATE POLICY "client_files_admin_select"
  ON public.client_files
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 4. Fix body_measurements admin policy ───────────────────
DROP POLICY IF EXISTS "body_measurements_admin_select" ON public.body_measurements;
CREATE POLICY "body_measurements_admin_select"
  ON public.body_measurements
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 5. Fix profiles admin policy ────────────────────────────
DROP POLICY IF EXISTS "profiles: admin read all" ON public.profiles;
CREATE POLICY "profiles: admin read all"
  ON public.profiles
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
