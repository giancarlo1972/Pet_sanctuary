/*
# Create public pet-photos storage bucket

1. Purpose
   - Story composer uploads story cover and gallery photos to a dedicated public
     bucket so they can be displayed via public URLs on the story detail screen.
   - Previously the composer uploaded to `report-photos` which worked but was
     semantically wrong; a dedicated `pet-photos` bucket keeps story images
     isolated and queryable.

2. Storage
   - Creates a PUBLIC bucket `pet-photos`.
   - Allows anon + authenticated to upload (stories can be drafted while signed
     in; reads are public so the community feed can render without auth).

3. Policies (storage.objects)
   - `pet_photos_read`  — SELECT for anon, authenticated on bucket_id = 'pet-photos'
   - `pet_photos_insert` — INSERT for anon, authenticated on bucket_id = 'pet-photos'
   - `pet_photos_update` — UPDATE for authenticated, owner only (auth.uid() = owner)
   - `pet_photos_delete` — DELETE for authenticated, owner only (auth.uid() = owner)

4. Notes
   - Idempotent: bucket insert uses ON CONFLICT; policies dropped before create.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('pet-photos', 'pet-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "pet_photos_read" ON storage.objects;
CREATE POLICY "pet_photos_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'pet-photos');

DROP POLICY IF EXISTS "pet_photos_insert" ON storage.objects;
CREATE POLICY "pet_photos_insert"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'pet-photos');

DROP POLICY IF EXISTS "pet_photos_update" ON storage.objects;
CREATE POLICY "pet_photos_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pet-photos' AND owner = auth.uid())
WITH CHECK (bucket_id = 'pet-photos' AND owner = auth.uid());

DROP POLICY IF EXISTS "pet_photos_delete" ON storage.objects;
CREATE POLICY "pet_photos_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pet-photos' AND owner = auth.uid());
