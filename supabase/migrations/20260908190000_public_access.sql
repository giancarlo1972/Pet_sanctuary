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
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organization_private'
  ) THEN
    REVOKE ALL ON organization_private FROM anon;
    GRANT SELECT, INSERT, UPDATE ON organization_private TO authenticated;
    EXECUTE 'ALTER TABLE organization_private ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DROP POLICY IF EXISTS op_org_members ON organization_private;
CREATE POLICY op_org_members ON organization_private FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_private.organization_id
        AND om.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = organization_private.organization_id
        AND o.created_by = auth.uid()
    )
  );
