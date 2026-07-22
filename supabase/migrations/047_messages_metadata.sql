-- 047_messages_metadata.sql
-- Adds a metadata JSONB column to messages for structured session invite data.
-- Used by session_invite attachment_type to store session_id, scheduled_at,
-- duration_minutes, and session_type without polluting the content field.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS metadata jsonb;
