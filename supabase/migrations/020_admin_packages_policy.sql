-- ============================================================
-- Migration 020 — Admin full access to packages table
-- ============================================================
-- Allows admin to INSERT and UPDATE packages for any client,
-- including deactivated ones (needed for renew, assign, expire).

DROP POLICY IF EXISTS "packages: admin insert" ON public.packages;
CREATE POLICY "packages: admin insert"
  ON public.packages
  FOR INSERT
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "packages: admin update" ON public.packages;
CREATE POLICY "packages: admin update"
  ON public.packages
  FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "packages: admin select" ON public.packages;
CREATE POLICY "packages: admin select"
  ON public.packages
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
