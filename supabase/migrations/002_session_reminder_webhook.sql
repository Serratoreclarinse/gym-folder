-- ============================================================
-- SESSION REMINDER WEBHOOK
-- ============================================================
-- This migration documents the webhook that must be created in
-- the Supabase dashboard (Database → Webhooks → Create new webhook).
--
-- Supabase does not support creating webhooks via SQL migrations,
-- so treat this file as runbook documentation + the test helper below.
--
-- Dashboard settings:
--   Name:        session-reminder
--   Table:       public.workout_sessions
--   Events:      INSERT
--   Type:        Supabase Edge Function
--   Function:    session-reminder
--   HTTP Headers:
--     x-supabase-signature: <your SUPABASE_WEBHOOK_SECRET>
-- ============================================================


-- ── Manual test helper ──────────────────────────────────────
-- Call this function from the SQL editor to simulate what the
-- webhook does, without actually inserting a session.
-- Useful for verifying email sends during development.
--
-- Usage:
--   select public.test_session_reminder('<package_id_uuid>');
--
create or replace function public.test_session_reminder(p_package_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pkg       record;
  v_client    record;
  v_coach     record;
  v_trigger   text;
  v_log_exists boolean;
begin
  -- Load the package
  select * into v_pkg from public.packages where id = p_package_id;
  if not found then
    return jsonb_build_object('error', 'Package not found');
  end if;

  -- Determine trigger
  v_trigger := case
    when v_pkg.sessions_remaining = 2 then '2_remaining'
    when v_pkg.sessions_remaining = 1 then '1_remaining'
    else null
  end;

  if v_trigger is null then
    return jsonb_build_object(
      'skipped', true,
      'sessions_remaining', v_pkg.sessions_remaining,
      'reason', 'sessions_remaining is not 1 or 2'
    );
  end if;

  -- Check dedup
  select exists(
    select 1 from public.email_logs
    where package_id = p_package_id and trigger_type = v_trigger::public.email_trigger_type
  ) into v_log_exists;

  -- Load profiles
  select name, email into v_client from public.profiles where id = v_pkg.client_id;
  select name, email into v_coach  from public.profiles where id = v_pkg.coach_id;

  return jsonb_build_object(
    'would_send',         not v_log_exists,
    'trigger_type',       v_trigger,
    'already_logged',     v_log_exists,
    'sessions_remaining', v_pkg.sessions_remaining,
    'package_type',       v_pkg.package_type,
    'client_name',        v_client.name,
    'client_email',       v_client.email,
    'coach_name',         v_coach.name,
    'coach_email',        v_coach.email
  );
end;
$$;
