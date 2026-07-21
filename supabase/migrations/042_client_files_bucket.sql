-- 042_client_files_bucket.sql
-- Ensure the client-files storage bucket exists and has the correct
-- policies so clients can upload their own progress photos.
-- Previously this bucket had no INSERT policy, so all client uploads failed.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-files',
  'client-files',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/heic','image/heif','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public             = true,
  file_size_limit    = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/heic','image/heif','image/webp'];

-- Client can upload to their own folder: progress/<their_uid>/<filename>
DROP POLICY IF EXISTS "client_files: client upload" ON storage.objects;
CREATE POLICY "client_files: client upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-files'
    AND (storage.foldername(name))[1] = 'progress'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Client can delete their own progress photos
DROP POLICY IF EXISTS "client_files: client delete" ON storage.objects;
CREATE POLICY "client_files: client delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-files'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Any authenticated user can read (bucket is public; this covers the auth API path)
DROP POLICY IF EXISTS "client_files: authenticated read" ON storage.objects;
CREATE POLICY "client_files: authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-files');
