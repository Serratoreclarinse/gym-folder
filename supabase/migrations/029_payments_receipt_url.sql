-- Add receipt_url column to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;

-- Create a public storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated coaches/admins can upload
DROP POLICY IF EXISTS "receipts: authenticated upload" ON storage.objects;
CREATE POLICY "receipts: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'admin')
        AND deactivated_at IS NULL
    )
  );

-- Authenticated coaches/admins can read
DROP POLICY IF EXISTS "receipts: authenticated read" ON storage.objects;
CREATE POLICY "receipts: authenticated read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'receipts'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('coach', 'admin')
    )
  );

-- Uploader can delete their own receipt
DROP POLICY IF EXISTS "receipts: owner delete" ON storage.objects;
CREATE POLICY "receipts: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'receipts'
    AND owner = auth.uid()
  );
