-- ============================================================
-- Migration 010 — Admin deactivate + restore account functions
-- ============================================================

-- ── 1. Admin SELECT policy on profiles ──────────────────────
-- Allows admin to read any profile (for client/coach list, detail pages, recycle bin).
-- Safe to run even if a manually-added version already exists.
DROP POLICY IF EXISTS "profiles: admin read all" ON public.profiles;
CREATE POLICY "profiles: admin read all"
  ON public.profiles
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── 2. admin_deactivate_account ─────────────────────────────
-- Soft-deletes a profile by setting deactivated_at = now().
-- SECURITY DEFINER bypasses RLS so admin can update any row.
DROP FUNCTION IF EXISTS public.admin_deactivate_account(uuid);
CREATE OR REPLACE FUNCTION public.admin_deactivate_account(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET deactivated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- ── 3. admin_restore_account ─────────────────────────────────
-- Undoes a soft-delete by clearing deactivated_at.
-- Called from the Recycle Bin "Restore" button.
DROP FUNCTION IF EXISTS public.admin_restore_account(uuid);
CREATE OR REPLACE FUNCTION public.admin_restore_account(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET deactivated_at = NULL
  WHERE id = p_user_id;
END;
$$;
