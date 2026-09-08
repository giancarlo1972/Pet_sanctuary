-- organizations.status is lowercase pending | approved | rejected | suspended
-- (plus aliases the app has written). Run in Supabase SQL Editor. Idempotent.

DO $$
BEGIN
  ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
EXCEPTION WHEN others THEN NULL;
END $$;

UPDATE organizations
SET status = CASE lower(coalesce(status, ''))
  WHEN 'pending_review' THEN 'pending'
  WHEN 'submitted' THEN 'pending'
  WHEN 'review' THEN 'pending'
  WHEN 'active' THEN 'approved'
  WHEN 'verified' THEN 'approved'
  WHEN 'registered' THEN 'approved'
  ELSE status
END
WHERE lower(coalesce(status, '')) IN (
  'pending_review', 'submitted', 'review', 'active', 'verified', 'registered'
);

DO $$
BEGIN
  ALTER TABLE organizations ALTER COLUMN status SET DEFAULT 'pending';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE organizations ADD CONSTRAINT organizations_status_check
    CHECK (status IS NULL OR lower(status) IN (
      'pending', 'approved', 'rejected', 'suspended'
    ));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Keep Ruuma as a sponsor if the earlier type update bounced on this check.
UPDATE organizations
SET
  org_type = 'sponsor',
  description = COALESCE(NULLIF(btrim(description), ''), 'Helps shelters and animals in need.')
WHERE lower(name) LIKE '%ruuma tech%';
