ALTER TABLE pets ADD COLUMN IF NOT EXISTS listing_type text NOT NULL DEFAULT 'private';
UPDATE pets SET listing_type = 'adoptable' WHERE shelter_id IS NOT NULL AND owner_id IS NULL;
UPDATE pets SET listing_type = 'private' WHERE owner_id IS NOT NULL;

DROP POLICY IF EXISTS public_read_pets ON pets;
DROP POLICY IF EXISTS pets_public_read ON pets;
DROP POLICY IF EXISTS pets_public_adoptable ON pets;
DROP POLICY IF EXISTS pets_private_owner ON pets;

CREATE POLICY pets_public_adoptable ON pets FOR SELECT TO anon, authenticated
  USING (listing_type = 'adoptable');

CREATE POLICY pets_private_owner ON pets FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM pet_relationships pr
      WHERE pr.pet_id = pets.id AND pr.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = pets.shelter_id AND om.user_id = auth.uid()
    )
  );
