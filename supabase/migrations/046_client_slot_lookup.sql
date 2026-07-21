-- 046_client_slot_lookup.sql
-- Secure RPC for clients to discover a coach's available time slots on a given date.
-- SECURITY DEFINER bypasses RLS so the function can check scheduled_sessions without
-- leaking other clients' personal data — only slot times + availability are returned.

CREATE OR REPLACE FUNCTION public.get_coach_slots(
  p_coach_id  uuid,
  p_date      text          -- YYYY-MM-DD
)
RETURNS TABLE (slot_time time, is_available boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date         date     := p_date::date;
  v_dow          integer  := EXTRACT(DOW FROM p_date::date)::integer;
  v_avail        coach_availability%ROWTYPE;
  v_cur          time;
  v_slot_end     time;
  v_dur          interval;
  v_in_break     boolean;
  v_booked       integer;
BEGIN
  SELECT * INTO v_avail
  FROM coach_availability
  WHERE coach_id = p_coach_id
    AND day_of_week = v_dow
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_dur := (v_avail.slot_duration || ' minutes')::interval;
  v_cur := v_avail.start_time::time;

  WHILE v_cur + v_dur <= v_avail.end_time::time LOOP
    v_slot_end := v_cur + v_dur;

    -- Skip slots that fall entirely inside a break
    SELECT EXISTS (
      SELECT 1 FROM availability_breaks
      WHERE availability_id = v_avail.id
        AND start_time::time <= v_cur
        AND end_time::time   >= v_slot_end
    ) INTO v_in_break;

    IF NOT v_in_break THEN
      -- Count confirmed/pending sessions that start in this slot window
      SELECT COUNT(*) INTO v_booked
      FROM scheduled_sessions
      WHERE coach_id        = p_coach_id
        AND scheduled_at::date = v_date
        AND scheduled_at::time >= v_cur
        AND scheduled_at::time <  v_slot_end
        AND status IN ('pending', 'client_confirmed');

      slot_time    := v_cur;
      is_available := v_booked < v_avail.max_clients;
      RETURN NEXT;
    END IF;

    v_cur := v_slot_end;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coach_slots(uuid, text) TO authenticated;
