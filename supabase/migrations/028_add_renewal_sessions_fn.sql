-- RPC function called by admin when accepting a renewal request.
-- Adds new sessions to the client's existing active package instead of
-- replacing it, so any remaining sessions carry over automatically.
CREATE OR REPLACE FUNCTION public.add_renewal_sessions(
  p_client_id UUID,
  p_sessions  INT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.packages
  SET total_sessions = total_sessions + p_sessions
  WHERE client_id = p_client_id
    AND status = 'active';

  -- If no active package exists (edge case), create a fresh one.
  -- This can happen if the old package expired between request and accept.
  IF NOT FOUND THEN
    INSERT INTO public.packages (client_id, total_sessions, sessions_used, status, start_date)
    VALUES (p_client_id, p_sessions, 0, 'active', CURRENT_DATE);
  END IF;
END;
$$;

-- Only admins (and service role) can call this function.
REVOKE ALL ON FUNCTION public.add_renewal_sessions(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_renewal_sessions(UUID, INT)
  TO authenticated;
