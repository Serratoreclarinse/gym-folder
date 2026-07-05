-- ============================================================
-- Migration 007 — RLS for client_files and push_tokens
-- Both tables existed in production without migrations or RLS.
-- ============================================================

-- ── push_tokens ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.push_tokens (
  user_id     UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Each user manages their own token
DROP POLICY IF EXISTS "push_tokens_own" ON public.push_tokens;
CREATE POLICY "push_tokens_own"
  ON public.push_tokens
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Coaches can read tokens of their own clients (to send notifications)
DROP POLICY IF EXISTS "push_tokens_coach_reads_clients" ON public.push_tokens;
CREATE POLICY "push_tokens_coach_reads_clients"
  ON public.push_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.packages p
      WHERE p.client_id = push_tokens.user_id
        AND p.coach_id  = auth.uid()
    )
  );

-- Clients can read tokens of their own coaches (e.g. notify coach of progress photo)
DROP POLICY IF EXISTS "push_tokens_client_reads_coaches" ON public.push_tokens;
CREATE POLICY "push_tokens_client_reads_coaches"
  ON public.push_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.packages p
      WHERE p.coach_id  = push_tokens.user_id
        AND p.client_id = auth.uid()
    )
  );

-- Admin can read all tokens (for broadcast notifications and transfer flows)
DROP POLICY IF EXISTS "push_tokens_admin_select" ON public.push_tokens;
CREATE POLICY "push_tokens_admin_select"
  ON public.push_tokens
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ── client_files ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.client_files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coach_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_type   TEXT NOT NULL CHECK (file_type IN ('image', 'pdf', 'link')),
  category    TEXT NOT NULL CHECK (category IN ('inbody', 'progress', 'document')),
  label       TEXT,
  description TEXT,
  date        DATE NOT NULL DEFAULT current_date,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_files_client_idx ON public.client_files (client_id);
CREATE INDEX IF NOT EXISTS client_files_coach_idx  ON public.client_files (coach_id);

ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;

-- Coaches can fully manage files they uploaded
DROP POLICY IF EXISTS "client_files_coach_full" ON public.client_files;
CREATE POLICY "client_files_coach_full"
  ON public.client_files
  FOR ALL
  USING  (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Clients can view their own files (read-only — coaches upload on their behalf)
DROP POLICY IF EXISTS "client_files_client_select" ON public.client_files;
CREATE POLICY "client_files_client_select"
  ON public.client_files
  FOR SELECT
  USING (client_id = auth.uid());

-- Admin can read all files
DROP POLICY IF EXISTS "client_files_admin_select" ON public.client_files;
CREATE POLICY "client_files_admin_select"
  ON public.client_files
  FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
