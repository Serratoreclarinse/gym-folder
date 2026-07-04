-- Soft-delete support: deactivated_at marks an account as deactivated (recycle bin).
-- NULL = active, non-NULL = deactivated.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ DEFAULT NULL;

-- Permanent delete: removes profile (cascades all data) and the auth user record.
-- SECURITY DEFINER runs as the function owner (postgres/superuser) so it can touch auth.users.
CREATE OR REPLACE FUNCTION admin_hard_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
