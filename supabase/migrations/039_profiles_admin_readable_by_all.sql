-- 039_profiles_admin_readable_by_all.sql
-- Allow any authenticated user to SELECT admin profiles.
-- Required so coaches and clients can look up the admin's user_id
-- when inserting in-app notifications (sendPushNotification).
-- Without this, coaches can only see their own clients' profiles,
-- so the admin notification lookup returns empty and admin never gets notified.

DROP POLICY IF EXISTS "profiles: any auth reads admins" ON public.profiles;
CREATE POLICY "profiles: any auth reads admins"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND role = 'admin'
  );
