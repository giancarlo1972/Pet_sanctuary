/*
# Fix pet_documents INSERT policy to allow shelter members

## Problem
The `pd_all` policy on `pet_documents` has a `WITH CHECK` clause that only
allows inserts from users with an active `pet_relationships` row (owners/fosters).
The `USING` clause allows both owners AND shelter members to read, but the
`WITH CHECK` does not include shelter members — so org staff who can view
documents cannot insert new ones, causing a 400 RLS violation.

## Fix
Replace the `pd_all` policy with four separate per-verb policies (SELECT,
INSERT, UPDATE, DELETE) that consistently check both `pet_relationships`
(owners/fosters with active relationships) AND `shelter_members` membership,
so the `WITH CHECK` on INSERT/UPDATE matches the `USING` on SELECT/DELETE.

## Security
- SELECT: owners/fosters + shelter members
- INSERT: owners/fosters + shelter members (WITH CHECK)
- UPDATE: owners/fosters + shelter members (USING + WITH CHECK)
- DELETE: owners/fosters + shelter members
- All scoped to `authenticated` role only.
*/

DROP POLICY IF EXISTS "pd_all" ON pet_documents;
DROP POLICY IF EXISTS "pd_select" ON pet_documents;
DROP POLICY IF EXISTS "pd_insert" ON pet_documents;
DROP POLICY IF EXISTS "pd_update" ON pet_documents;
DROP POLICY IF EXISTS "pd_delete" ON pet_documents;

-- SELECT: owners/fosters + shelter members
CREATE POLICY "pd_select" ON pet_documents FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = pet_documents.pet_id
        AND r.user_id = auth.uid()
        AND r.ended_on IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = pet_documents.pet_id
        AND sm.user_id = auth.uid()
    )
  );

-- INSERT: owners/fosters + shelter members
CREATE POLICY "pd_insert" ON pet_documents FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = pet_documents.pet_id
        AND r.user_id = auth.uid()
        AND r.ended_on IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = pet_documents.pet_id
        AND sm.user_id = auth.uid()
    )
  );

-- UPDATE: owners/fosters + shelter members
CREATE POLICY "pd_update" ON pet_documents FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = pet_documents.pet_id
        AND r.user_id = auth.uid()
        AND r.ended_on IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = pet_documents.pet_id
        AND sm.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = pet_documents.pet_id
        AND r.user_id = auth.uid()
        AND r.ended_on IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = pet_documents.pet_id
        AND sm.user_id = auth.uid()
    )
  );

-- DELETE: owners/fosters + shelter members
CREATE POLICY "pd_delete" ON pet_documents FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = pet_documents.pet_id
        AND r.user_id = auth.uid()
        AND r.ended_on IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = pet_documents.pet_id
        AND sm.user_id = auth.uid()
    )
  );
