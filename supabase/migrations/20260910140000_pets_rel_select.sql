-- Shared-with-me rows need to read the pet (name + photo) via the relationship.
DROP POLICY IF EXISTS pets_rel_select ON pets;
CREATE POLICY pets_rel_select ON pets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pet_relationships pr
      WHERE pr.pet_id = pets.id
        AND pr.user_id = auth.uid()
        AND pr.ended_on IS NULL
    )
  );
