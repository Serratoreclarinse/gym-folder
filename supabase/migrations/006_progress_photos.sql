-- Progress photos: client-sent photos visible to their coach
CREATE TABLE IF NOT EXISTS progress_photos (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_url  TEXT NOT NULL,
  note      TEXT,
  sent_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_photos_client_insert" ON progress_photos
  FOR INSERT WITH CHECK (auth.uid() = client_id);

CREATE POLICY "progress_photos_client_select" ON progress_photos
  FOR SELECT USING (auth.uid() = client_id);

CREATE POLICY "progress_photos_client_delete" ON progress_photos
  FOR DELETE USING (auth.uid() = client_id);

CREATE POLICY "progress_photos_coach_select" ON progress_photos
  FOR SELECT USING (auth.uid() = coach_id);
