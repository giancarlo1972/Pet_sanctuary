-- Public org-card badges + Home Trending seed.
-- Run in Supabase SQL Editor. Idempotent. Postgres role (bypasses cn_admin RLS).

DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['ein_verified', 'tax_deductible', 'updated_at']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = col
    ) THEN
      EXECUTE format('GRANT SELECT (%I) ON organizations TO anon', col);
    END IF;
  END LOOP;
END $$;

INSERT INTO community_needs (title, body, need_type, status, org_id, created_at)
SELECT
  'Happy Paws needs a ride: 2 cats to Hudson Vet Clinic',
  '3.1 mi · Brooklyn → Manhattan',
  'ride',
  'open',
  (SELECT id FROM organizations WHERE name ILIKE '%Happy Paws%' ORDER BY name LIMIT 1),
  now() - interval '2 hours'
WHERE NOT EXISTS (
  SELECT 1 FROM community_needs
  WHERE title = 'Happy Paws needs a ride: 2 cats to Hudson Vet Clinic'
);

INSERT INTO community_needs (title, body, need_type, status, org_id, created_at)
SELECT
  'Second Chance Sanctuary is low on kitten formula',
  '4 of 12 cans donated',
  'supplies',
  'open',
  (SELECT id FROM organizations WHERE name ILIKE '%Second Chance%' ORDER BY name LIMIT 1),
  now() - interval '5 hours'
WHERE NOT EXISTS (
  SELECT 1 FROM community_needs
  WHERE title = 'Second Chance Sanctuary is low on kitten formula'
);
