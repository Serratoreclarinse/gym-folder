-- Add '3_remaining' and '0_remaining' to the email_trigger_type enum.
-- 3/2/1 → push + in-app only. 1/0 → also send email.
alter type public.email_trigger_type add value if not exists '3_remaining';
alter type public.email_trigger_type add value if not exists '0_remaining';
