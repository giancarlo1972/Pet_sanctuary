-- Ruuma Tech LLC is a sponsor (helps shelters & animals), not a rescue group.
-- Run in Supabase SQL Editor. Idempotent.

DO $$
BEGIN
  ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_org_type_check;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE organizations ADD CONSTRAINT organizations_org_type_check
    CHECK (org_type IS NULL OR lower(org_type) IN (
      'shelter', 'animal_shelter',
      'rescue_group', 'rescue',
      'clinic', 'veterinary_clinic',
      'sponsor', 'business',
      'nonprofit', 'municipal', 'individual', 'other'
    ));
EXCEPTION WHEN others THEN NULL;
END $$;

UPDATE organizations
SET
  org_type = 'sponsor',
  description = COALESCE(NULLIF(btrim(description), ''), 'Helps shelters and animals in need.')
WHERE lower(name) LIKE '%ruuma tech%';
