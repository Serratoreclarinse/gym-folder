-- Fix 1: Add notifications to real-time publication so the bell badge
--         and notification list update instantly without a screen refresh.
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Fix 2: Simplify RLS policies — the old dual-policy setup
--         (FOR ALL + FOR INSERT) can cause ambiguous behaviour for
--         cross-user inserts (coach inserting a notification for a client).
--         Replace with three clear, single-purpose policies.

DROP POLICY IF EXISTS "notifications_own"          ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_auth"  ON public.notifications;

-- Users can read and update (mark-read) their own notifications
CREATE POLICY "notifications_select_update"
  ON public.notifications
  FOR SELECT USING      (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE USING      (user_id = auth.uid())
             WITH CHECK (user_id = auth.uid());

-- Any authenticated user can insert a notification for any recipient
-- (coach → client, client → coach, system → anyone)
CREATE POLICY "notifications_insert_any_auth"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
