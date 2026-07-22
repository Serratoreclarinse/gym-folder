-- ============================================================
-- Migration 019 — admin_deactivate_account also expires packages
-- ============================================================
-- When an account is deactivated, all of that user's active
-- packages are automatically expired so they don't show as
-- active clients in any coach or admin view.

DROP FUNCTION IF EXISTS public.admin_deactivate_account(uuid);
CREATE OR REPLACE FUNCTION public.admin_deactivate_account(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Soft-delete the profile
  UPDATE public.profiles
  SET deactivated_at = now()
  WHERE id = p_user_id;

  -- Expire all active packages for this user (as client)
  UPDATE public.packages
  SET status = 'expired'
  WHERE client_id = p_user_id
    AND status = 'active';
END;
$$;
