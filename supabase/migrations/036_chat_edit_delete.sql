-- Allow any file type in chat-attachments (was too restrictive, caused silent upload failures)
UPDATE storage.buckets
SET allowed_mime_types = null
WHERE id = 'chat-attachments';

-- Add edit + soft-delete support to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_edited          boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at          timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_for_sender   boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_for_receiver boolean     NOT NULL DEFAULT false;

-- Allow users to update their own sent messages (edit + delete for sender side)
DROP POLICY IF EXISTS "messages_update_own" ON public.messages;
CREATE POLICY "messages_update_own"
  ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- Allow receiver to soft-delete for themselves
DROP POLICY IF EXISTS "messages_update_received" ON public.messages;
CREATE POLICY "messages_update_received"
  ON public.messages FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());
