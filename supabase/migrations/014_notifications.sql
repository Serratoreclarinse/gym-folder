-- ============================================================
-- Migration 014 — In-app notification inbox
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  data       JSONB       NOT NULL DEFAULT '{}',
  read       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_created
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users read/update their own notifications
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own"
  ON public.notifications
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Any authenticated user can insert a notification for any recipient
-- (coach → client, client → coach, admin → anyone)
DROP POLICY IF EXISTS "notifications_insert_auth" ON public.notifications;
CREATE POLICY "notifications_insert_auth"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
