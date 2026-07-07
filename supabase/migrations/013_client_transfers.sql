-- ============================================================
-- Migration 013 — Client transfers
-- Coach requests → admin approves → new coach accepts/rejects
-- ============================================================

CREATE TABLE IF NOT EXISTS public.client_transfers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      UUID NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  package_id     UUID NOT NULL REFERENCES public.packages(id)  ON DELETE CASCADE,
  from_coach_id  UUID NOT NULL REFERENCES public.profiles(id),
  to_coach_id    UUID NOT NULL REFERENCES public.profiles(id),
  status         TEXT NOT NULL DEFAULT 'pending_admin'
    CHECK (status IN ('pending_admin','pending_coach','accepted','rejected_admin','rejected_coach','cancelled')),
  notes          TEXT,
  admin_notes    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_transfers_client_idx    ON public.client_transfers (client_id);
CREATE INDEX IF NOT EXISTS client_transfers_from_coach_idx ON public.client_transfers (from_coach_id);
CREATE INDEX IF NOT EXISTS client_transfers_to_coach_idx  ON public.client_transfers (to_coach_id, status);

ALTER TABLE public.client_transfers ENABLE ROW LEVEL SECURITY;

-- From-coach: full access to their own requests
DROP POLICY IF EXISTS "transfers_from_coach" ON public.client_transfers;
CREATE POLICY "transfers_from_coach"
  ON public.client_transfers FOR ALL
  USING  (from_coach_id = auth.uid())
  WITH CHECK (from_coach_id = auth.uid());

-- To-coach: can read transfers directed at them
DROP POLICY IF EXISTS "transfers_to_coach_select" ON public.client_transfers;
CREATE POLICY "transfers_to_coach_select"
  ON public.client_transfers FOR SELECT
  USING (to_coach_id = auth.uid());

-- Admin: read all
DROP POLICY IF EXISTS "transfers_admin_select" ON public.client_transfers;
CREATE POLICY "transfers_admin_select"
  ON public.client_transfers FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── RPCs ─────────────────────────────────────────────────────

-- Coach submits a transfer request
DROP FUNCTION IF EXISTS public.coach_initiate_transfer(uuid, uuid, uuid, text);
CREATE OR REPLACE FUNCTION public.coach_initiate_transfer(
  p_client_id   UUID,
  p_to_coach_id UUID,
  p_package_id  UUID,
  p_notes       TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.client_transfers
    (client_id, package_id, from_coach_id, to_coach_id, status, notes)
  VALUES
    (p_client_id, p_package_id, auth.uid(), p_to_coach_id, 'pending_admin', p_notes);
END;
$$;

-- Admin approves → forwards to receiving coach
DROP FUNCTION IF EXISTS public.admin_approve_transfer(uuid, text);
CREATE OR REPLACE FUNCTION public.admin_approve_transfer(
  p_transfer_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.client_transfers
  SET status = 'pending_coach', admin_notes = p_admin_notes
  WHERE id = p_transfer_id AND status = 'pending_admin';
END;
$$;

-- Admin rejects
DROP FUNCTION IF EXISTS public.admin_reject_transfer(uuid, text);
CREATE OR REPLACE FUNCTION public.admin_reject_transfer(
  p_transfer_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.client_transfers
  SET status = 'rejected_admin', admin_notes = p_admin_notes
  WHERE id = p_transfer_id AND status = 'pending_admin';
END;
$$;

-- Receiving coach accepts → package coach_id updated
DROP FUNCTION IF EXISTS public.coach_accept_transfer(uuid);
CREATE OR REPLACE FUNCTION public.coach_accept_transfer(p_transfer_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_package_id  UUID;
  v_to_coach_id UUID;
BEGIN
  SELECT package_id, to_coach_id
  INTO v_package_id, v_to_coach_id
  FROM public.client_transfers
  WHERE id = p_transfer_id AND status = 'pending_coach';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transfer not found or not awaiting coach acceptance';
  END IF;

  UPDATE public.packages
  SET coach_id = v_to_coach_id
  WHERE id = v_package_id;

  UPDATE public.client_transfers
  SET status = 'accepted'
  WHERE id = p_transfer_id;
END;
$$;

-- Receiving coach rejects
DROP FUNCTION IF EXISTS public.coach_reject_transfer(uuid);
CREATE OR REPLACE FUNCTION public.coach_reject_transfer(p_transfer_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.client_transfers
  SET status = 'rejected_coach'
  WHERE id = p_transfer_id AND status = 'pending_coach';
END;
$$;
