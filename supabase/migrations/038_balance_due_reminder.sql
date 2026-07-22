-- 038_balance_due_reminder.sql
-- Tracks whether balance-due push notifications have been sent per renewal,
-- and schedules a daily cron job to fire the balance-due-reminder edge function.
--
-- PREREQUISITES (already enabled if you ran migration 017):
--   pg_cron  — Database → Extensions → pg_cron
--   pg_net   — Database → Extensions → pg_net
--
-- SETUP STEPS before running this migration:
--   1. Deploy the edge function:
--        npx supabase functions deploy balance-due-reminder
--
--   2. In Supabase Dashboard → Edge Functions → balance-due-reminder → Secrets, add:
--        BALANCE_DUE_SECRET = gcbalancedue2024
--
--   3. Then run this migration in the SQL Editor.
--
-- SCHEDULE: daily at 8:00 UTC (noon Gulf/Oman time)

-- Notification tracking flags on renewal_requests
ALTER TABLE public.renewal_requests
  ADD COLUMN IF NOT EXISTS balance_notif_warning_sent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS balance_notif_due_sent     BOOLEAN NOT NULL DEFAULT false;

-- Daily cron: 8am UTC every day
SELECT cron.schedule(
  'balance-due-reminder-daily',
  '0 8 * * *',
  $cron$
    SELECT net.http_post(
      url     := 'https://crdefmftxjhdcxqqrxuu.supabase.co/functions/v1/balance-due-reminder',
      headers := '{"Authorization":"Bearer gcbalancedue2024","Content-Type":"application/json"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
  $cron$
);

-- To verify: SELECT jobname, schedule FROM cron.job;
-- To remove: SELECT cron.unschedule('balance-due-reminder-daily');
