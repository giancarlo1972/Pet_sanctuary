-- Public-access policy: visitors can browse approved orgs, adoptable pets,
-- stories, Nearby, Care Fund, and file a report. Person records stay signed-in.
-- EIN / verification docs stay on organization_private (members + platform).
-- Run in Supabase SQL Editor. Idempotent.

DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'id', 'name', 'org_type', 'address', 'city', 'state', 'phone',
    'contact_email', 'website', 'logo_url', 'status', 'data_source',
    'description', 'latitude', 'longitude', 'external_id'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = col
    ) THEN
      EXECUTE format('GRANT SELECT (%I) ON organizations TO anon', col);
    END IF;
  END LOOP;
END $$;

REVOKE SELECT (ein) ON organizations FROM anon;
REVOKE SELECT (verification_doc_url) ON organizations FROM anon;

DROP POLICY IF EXISTS "public_read_approved_orgs" ON public.organizations;
CREATE POLICY "public_read_approved_orgs"
  ON public.organizations FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS pets_public_adoptable ON pets;
CREATE POLICY pets_public_adoptable ON pets FOR SELECT TO anon, authenticated
  USING (listing_type = 'adoptable' AND COALESCE(is_public, true));

REVOKE SELECT (contact_phone, contact_name, contact_email) ON reports FROM anon;
REVOKE SELECT (contact_phone) ON reports FROM authenticated;

DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports"
  ON reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    CASE
      WHEN auth.uid() IS NULL THEN status = 'pending_moderation'
      ELSE true
    END
  );

DO $$
DECLARE
  org_col text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_private'
  ) THEN
    RETURN;
  END IF;

  REVOKE ALL ON organization_private FROM anon;
  GRANT SELECT, INSERT, UPDATE ON organization_private TO authenticated;
  ALTER TABLE organization_private ENABLE ROW LEVEL SECURITY;

  SELECT c.column_name INTO org_col
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'organization_private'
    AND c.column_name IN ('organization_id', 'org_id', 'id')
  ORDER BY CASE c.column_name
    WHEN 'organization_id' THEN 1
    WHEN 'org_id' THEN 2
    ELSE 3
  END
  LIMIT 1;

  IF org_col IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'DROP POLICY IF EXISTS op_org_members ON organization_private';
  EXECUTE format(
    $p$
    CREATE POLICY op_org_members ON organization_private FOR SELECT TO authenticated
      USING (
        is_platform_admin()
        OR EXISTS (
          SELECT 1 FROM organization_members om
          WHERE om.organization_id = organization_private.%I
            AND om.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM organizations o
          WHERE o.id = organization_private.%I
            AND o.created_by = auth.uid()
        )
      )
    $p$, org_col, org_col
  );
END $$;
