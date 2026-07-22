-- Add attachment support to messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT CHECK (attachment_type IN ('image', 'video', 'file')),
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Storage bucket for chat attachments (public so URLs don't expire)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  52428800,  -- 50 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/x-msvideo','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Any authenticated user can upload attachments (they always upload to their own folder)
DROP POLICY IF EXISTS "chat_attach_upload" ON storage.objects;
CREATE POLICY "chat_attach_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

-- Public bucket — anyone can read (no auth needed for image rendering)
DROP POLICY IF EXISTS "chat_attach_read" ON storage.objects;
CREATE POLICY "chat_attach_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments');
