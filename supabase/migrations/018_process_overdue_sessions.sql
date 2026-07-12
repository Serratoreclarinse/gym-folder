-- ─────────────────────────────────────────────────────────────────────────────
-- 018_process_overdue_sessions.sql
-- Auto-marks workout sessions that are past their date and still "pending"
-- as "no_show". Called by the coach calendar screen on focus to keep session
-- status current without requiring manual intervention for forgotten sessions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.process_overdue_sessions(p_coach_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE workout_sessions
  SET    status = 'no_show'
  WHERE  coach_id   = p_coach_id
    AND  status     = 'pending'
    AND  session_date < current_date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_overdue_sessions(uuid) TO authenticated;
