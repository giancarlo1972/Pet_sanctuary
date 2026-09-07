-- Two-tier admin: platform admins (Rescue Army) + one org admin per organization
-- Run in Supabase SQL Editor. Idempotent.

-- 1. Platform admin = profiles.role = 'admin'  (already exists)
-- 2. Org admin = organization_members.role = 'admin' for that org (table already exists)

-- Helper: is current user a platform admin?
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Helper: is current user admin of a given org?
CREATE OR REPLACE FUNCTION public.is_org_admin(org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM organization_members
                 WHERE organization_id = org AND user_id = auth.uid() AND role = 'admin');
$$;

REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;

-- One admin per org (enforced)
CREATE UNIQUE INDEX IF NOT EXISTS one_admin_per_org
  ON organization_members (organization_id) WHERE role = 'admin';

-- Org invites
CREATE TABLE IF NOT EXISTS organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'staff',           -- staff | volunteer | foster_coordinator
  invited_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending',       -- pending | accepted | revoked
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oi_org_admin_all ON organization_invites;
CREATE POLICY oi_org_admin_all ON organization_invites FOR ALL TO authenticated
  USING (is_org_admin(organization_id) OR is_platform_admin())
  WITH CHECK (is_org_admin(organization_id) OR is_platform_admin());

-- organization_members: org admin manages own org; platform admin manages all
DROP POLICY IF EXISTS admins_update_membership ON organization_members;
DROP POLICY IF EXISTS om_manage ON organization_members;
CREATE POLICY om_manage ON organization_members FOR ALL TO authenticated
  USING (is_org_admin(organization_id) OR is_platform_admin())
  WITH CHECK (is_org_admin(organization_id) OR is_platform_admin());
-- keep existing members_read_own_membership + creator_insert_membership as-is

-- Platform admins: assign/reassign any org's admin, read all orgs (incl. pending)
DROP POLICY IF EXISTS platform_admin_orgs ON organizations;
CREATE POLICY platform_admin_orgs ON organizations FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Org-scoped requests: org admins see/decide only their org's items
DROP POLICY IF EXISTS rar_org_admin ON record_access_requests;
CREATE POLICY rar_org_admin ON record_access_requests FOR ALL TO authenticated
  USING (is_platform_admin() OR EXISTS (
    SELECT 1 FROM pets p WHERE p.id = record_access_requests.pet_id AND is_org_admin(p.shelter_id)))
  WITH CHECK (is_platform_admin() OR EXISTS (
    SELECT 1 FROM pets p WHERE p.id = record_access_requests.pet_id AND is_org_admin(p.shelter_id)));

-- Moderation queue: platform admins only (replaces the open policies)
DROP POLICY IF EXISTS read_moderation_queue ON moderation_queue;
DROP POLICY IF EXISTS update_moderation_queue ON moderation_queue;
DROP POLICY IF EXISTS mq_admins_select ON moderation_queue;
DROP POLICY IF EXISTS mq_admins_update ON moderation_queue;
DROP POLICY IF EXISTS mq_platform_admin ON moderation_queue;
CREATE POLICY mq_platform_admin ON moderation_queue FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Audit log for admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  subject_type text, subject_id uuid,
  organization_id uuid,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_read ON audit_log;
CREATE POLICY audit_read ON audit_log FOR SELECT TO authenticated
  USING (is_platform_admin() OR (organization_id IS NOT NULL AND is_org_admin(organization_id)));
DROP POLICY IF EXISTS audit_insert ON audit_log;
CREATE POLICY audit_insert ON audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());
