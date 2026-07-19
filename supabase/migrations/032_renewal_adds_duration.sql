-- Fix: renewal should ADD weeks to existing duration (not reset start_date)
-- Active package → end_date extends from current end
-- Expired package → start fresh from tomorrow with new duration

DROP FUNCTION IF EXISTS public.add_renewal_sessions(UUID, INT);
DROP FUNCTION IF EXISTS public.add_renewal_sessions(UUID, INT, INT);

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
    -- Still active: add weeks on top of current end date
    -- Expired:      start fresh from tomorrow with new duration only
    duration_weeks = CASE
      WHEN p_duration_weeks IS NULL
        THEN duration_weeks
      WHEN (start_date + (COALESCE(duration_weeks, 0) * 7 || ' days')::INTERVAL)::DATE > CURRENT_DATE
        THEN duration_weeks + p_duration_weeks
      ELSE
        p_duration_weeks
    END,
    start_date = CASE
      WHEN p_duration_weeks IS NOT NULL
        AND (start_date + (COALESCE(duration_weeks, 0) * 7 || ' days')::INTERVAL)::DATE <= CURRENT_DATE
        THEN CURRENT_DATE + 1
      ELSE start_date
    END
  WHERE client_id = p_client_id AND status = 'active';

  IF NOT FOUND THEN
    INSERT INTO public.packages (client_id, total_sessions, sessions_used, status, start_date, duration_weeks)
    VALUES (p_client_id, p_sessions, 0, 'active', CURRENT_DATE + 1, p_duration_weeks);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.add_renewal_sessions(UUID, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_renewal_sessions(UUID, INT, INT) TO authenticated;
