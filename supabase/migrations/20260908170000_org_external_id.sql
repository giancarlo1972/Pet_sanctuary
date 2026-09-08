-- Organizations: RescueGroups external id + directory indexes.
-- Run in Supabase SQL Editor. Idempotent.
-- Column-level GRANTs are required: table SELECT was revoked to hide ein.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS external_id text;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_external_id_uidx
  ON organizations (external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS organizations_status_name ON organizations (status, name);
CREATE INDEX IF NOT EXISTS organizations_type_status ON organizations (org_type, status);

-- Existing RescueGroups-synced rows keep their uuid. external_id is filled
-- from rg-{orgID} when a listing is matched by name (Community) or on sync.
GRANT SELECT (external_id) ON organizations TO anon, authenticated;

DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'ein_verified', 'tax_deductible', 'donations_enabled', 'data_source',
    'donate_url', 'paypal_me', 'venmo_handle', 'location'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = col
    ) THEN
      EXECUTE format('GRANT SELECT (%I) ON organizations TO anon, authenticated', col);
    END IF;
  END LOOP;
END $$;
