-- Platform console: support tickets, community needs, audit columns, admin policies.
-- Idempotent. Platform admin only.

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS acting_as text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS target_type text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS target_id uuid;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS meta jsonb;
UPDATE audit_log SET target_type = subject_type WHERE target_type IS NULL AND subject_type IS NOT NULL;
UPDATE audit_log SET target_id = subject_id WHERE target_id IS NULL AND subject_id IS NOT NULL;
UPDATE audit_log SET meta = detail WHERE meta IS NULL AND detail IS NOT NULL;

ALTER TABLE pets ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS merged_into uuid;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS assigned_to uuid;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS false_report boolean NOT NULL DEFAULT false;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS severity text;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ein_verified boolean DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS rg_sync_status text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS rg_synced_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS data_source text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS merged_into uuid;

ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS assignee_id uuid;
ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS reply text;

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  subject text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'open',
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
  ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check
    CHECK (status IN ('open','pending','resolved','closed'));
EXCEPTION WHEN others THEN NULL;
END $$;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS st_own ON support_tickets;
CREATE POLICY st_own ON support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_platform_admin());
DROP POLICY IF EXISTS st_own_insert ON support_tickets;
CREATE POLICY st_own_insert ON support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR is_platform_admin());
DROP POLICY IF EXISTS st_admin ON support_tickets;
CREATE POLICY st_admin ON support_tickets FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

CREATE TABLE IF NOT EXISTS community_needs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  need_type text NOT NULL DEFAULT 'need',
  status text NOT NULL DEFAULT 'open',
  pinned boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  org_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE community_needs DROP CONSTRAINT IF EXISTS community_needs_status_check;
  ALTER TABLE community_needs ADD CONSTRAINT community_needs_status_check
    CHECK (status IN ('open','pinned','expired','closed'));
EXCEPTION WHEN others THEN NULL;
END $$;
ALTER TABLE community_needs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cn_read ON community_needs;
CREATE POLICY cn_read ON community_needs FOR SELECT TO authenticated
  USING (status IN ('open','pinned') OR is_platform_admin());
DROP POLICY IF EXISTS cn_admin ON community_needs;
CREATE POLICY cn_admin ON community_needs FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS pets_platform_admin ON pets;
CREATE POLICY pets_platform_admin ON pets FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS reports_platform_admin ON reports;
CREATE POLICY reports_platform_admin ON reports FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS orgs_platform_admin ON organizations;
CREATE POLICY orgs_platform_admin ON organizations FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

CREATE TABLE IF NOT EXISTS organization_private (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  ein text
);
ALTER TABLE organization_private ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS op_platform ON organization_private;
CREATE POLICY op_platform ON organization_private FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

CREATE OR REPLACE FUNCTION public.platform_merge_pets(keep_id uuid, drop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF keep_id IS NULL OR drop_id IS NULL OR keep_id = drop_id THEN RAISE EXCEPTION 'invalid merge'; END IF;
  UPDATE pets SET merged_into = keep_id, hidden = true, listing_type = 'private', is_public = false WHERE id = drop_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_merge_pets(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_merge_orgs(keep_id uuid, drop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF keep_id IS NULL OR drop_id IS NULL OR keep_id = drop_id THEN RAISE EXCEPTION 'invalid merge'; END IF;
  UPDATE organization_members SET organization_id = keep_id
    WHERE organization_id = drop_id
      AND NOT EXISTS (
        SELECT 1 FROM organization_members x
        WHERE x.organization_id = keep_id AND x.user_id = organization_members.user_id
      );
  DELETE FROM organization_members WHERE organization_id = drop_id;
  UPDATE pets SET shelter_id = keep_id WHERE shelter_id = drop_id;
  UPDATE organizations SET merged_into = keep_id, status = 'merged' WHERE id = drop_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_merge_orgs(uuid, uuid) TO authenticated;
