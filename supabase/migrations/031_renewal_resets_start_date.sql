-- Drop old 2-arg version so we can recreate with new optional param
DROP FUNCTION IF EXISTS public.add_renewal_sessions(UUID, INT);

-- Renewal now resets start_date to today and accepts optional new duration
CREATE OR REPLACE FUNCTION public.add_renewal_sessions(
  p_client_id      UUID,
  p_sessions       INT,
  p_duration_weeks INT DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.packages
  SET
    total_sessions = total_sessions + p_sessions,
    start_date     = CURRENT_DATE,
    duration_weeks = COALESCE(p_duration_weeks, duration_weeks)
  WHERE client_id = p_client_id AND status = 'active';

  IF NOT FOUND THEN
    INSERT INTO public.packages (client_id, total_sessions, sessions_used, status, start_date, duration_weeks)
    VALUES (p_client_id, p_sessions, 0, 'active', CURRENT_DATE, p_duration_weeks);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.add_renewal_sessions(UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_renewal_sessions(UUID, INT, INT) TO authenticated;
