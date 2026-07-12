-- ─────────────────────────────────────────────────────────────────────────────
-- 017_sales_closing_cron.sql
-- Automated sales-closing reminders for coaches
--
-- PREREQUISITES (one-time setup in Supabase Dashboard → Database → Extensions):
--   1. Enable "pg_cron"  (schedules recurring SQL jobs)
--   2. Enable "pg_net"   (makes outbound HTTP requests from SQL)
--
-- SETUP STEPS before running this migration:
--   1. Deploy the Edge Function:
--        supabase functions deploy sales-closing-reminder
--
--   2. In Supabase Dashboard → Edge Functions → sales-closing-reminder → Secrets,
--      add:   SALES_REMINDER_SECRET = <any strong random string you choose>
--
--   3. Replace the two placeholders below:
--        YOUR_PROJECT_REF    → your Supabase project ref  (e.g. abcdefghijklmnop)
--        YOUR_REMINDER_SECRET → the same secret you set above
--
-- SCHEDULE:
--   • 28th of each month at 09:00 UTC → type=warning  (7-day heads-up)
--   • 4th  of each month at 09:00 UTC → type=closing  (deadline day)
-- ─────────────────────────────────────────────────────────────────────────────

-- Warning reminder — 28th of every month at 09:00 UTC
SELECT cron.schedule(
  'sales-closing-warning',
  '0 9 28 * *',
  $cron$
    SELECT net.http_post(
      url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sales-closing-reminder',
      headers := '{"Authorization":"Bearer YOUR_REMINDER_SECRET","Content-Type":"application/json"}'::jsonb,
      body    := '{"type":"warning"}'::jsonb
    ) AS request_id;
  $cron$
);

-- Final closing reminder — 4th of every month at 09:00 UTC
SELECT cron.schedule(
  'sales-closing-final',
  '0 9 4 * *',
  $cron$
    SELECT net.http_post(
      url     := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/sales-closing-reminder',
      headers := '{"Authorization":"Bearer YOUR_REMINDER_SECRET","Content-Type":"application/json"}'::jsonb,
      body    := '{"type":"closing"}'::jsonb
    ) AS request_id;
  $cron$
);

-- To verify jobs are registered:
-- SELECT jobname, schedule, command FROM cron.job;

-- To remove jobs if needed:
-- SELECT cron.unschedule('sales-closing-warning');
-- SELECT cron.unschedule('sales-closing-final');
