-- Roles v2: profiles.role ∈ {platform_admin, member};
-- org_admin from organization_members.role='admin' (multiple allowed);
-- pet admin = pets.owner_id; sharing via pet_relationships + invites.

UPDATE profiles SET role = CASE
  WHEN lower(coalesce(role, '')) IN (
    'platform_admin','admin','application_admin','app_admin',
    'devops','devops_admin','owner','superadmin','administrator'
  ) THEN 'platform_admin'
  ELSE 'member'
END;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.contype = 'c' AND n.nspname = 'public' AND cl.relname = 'profiles'
      AND (c.conname ILIKE '%role%' OR pg_get_constraintdef(c.oid) ILIKE '%role%')
  LOOP
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IS NULL OR role IN ('platform_admin', 'member'));

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'platform_admin'
      AND coalesce(blocked, false) = false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org AND user_id = auth.uid() AND role = 'admin'
  ) AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND coalesce(blocked, false) = false
  );
$$;

DROP INDEX IF EXISTS one_admin_per_org;

-- Sharing helpers
CREATE OR REPLACE FUNCTION public.pet_rel_level(pid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM pets p WHERE p.id = pid AND p.owner_id = auth.uid()) THEN 'owner'
    WHEN EXISTS (
      SELECT 1 FROM pet_relationships pr
      WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
        AND pr.relationship IN ('owner','own')
    ) THEN 'owner'
    WHEN EXISTS (
      SELECT 1 FROM pet_relationships pr
      WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
        AND pr.relationship IN ('co_owner','co-owner')
    ) THEN 'co_owner'
    WHEN EXISTS (
      SELECT 1 FROM pet_relationships pr
      WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
        AND pr.relationship = 'veterinarian'
    ) THEN 'veterinarian'
    WHEN EXISTS (
      SELECT 1 FROM pet_relationships pr
      WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
        AND pr.relationship IN ('caretaker','foster')
    ) THEN 'caretaker'
    ELSE NULL
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.pet_rel_level(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pet_rel_level(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_pet(pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pet_rel_level(pid) IN ('owner','co_owner') OR is_platform_admin();
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_pet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_pet(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_pet_medical(pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    is_platform_admin()
    OR pet_rel_level(pid) IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM pets p
      JOIN organization_members om ON om.organization_id = p.shelter_id AND om.user_id = auth.uid()
      WHERE p.id = pid
    );
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_pet_medical(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_pet_medical(uuid) TO authenticated, postgres;

CREATE OR REPLACE FUNCTION public.can_write_pet_clinical(pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pet_rel_level(pid) IN ('owner','co_owner','veterinarian') OR is_platform_admin();
$$;
REVOKE EXECUTE ON FUNCTION public.can_write_pet_clinical(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_pet_clinical(uuid) TO authenticated, postgres;

CREATE OR REPLACE FUNCTION public.can_care_pet(pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pet_rel_level(pid) IN ('owner','co_owner','caretaker','veterinarian') OR is_platform_admin();
$$;
REVOKE EXECUTE ON FUNCTION public.can_care_pet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_care_pet(uuid) TO authenticated;

DO $$
BEGIN
  ALTER TABLE pet_relationships DROP CONSTRAINT IF EXISTS pet_relationships_relationship_check;
  ALTER TABLE pet_relationships ADD CONSTRAINT pet_relationships_relationship_check
    CHECK (relationship IN (
      'owner','own','foster','sponsor','sponsored','co_owner','co-owner',
      'caretaker','adopter','veterinarian'
    ));
EXCEPTION WHEN check_violation THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS pet_share_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  level text NOT NULL CHECK (level IN ('co_owner','caretaker','veterinarian')),
  invited_email text,
  invited_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  accepted_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '14 days')
);
ALTER TABLE pet_share_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS psi_manage ON pet_share_invites;
CREATE POLICY psi_manage ON pet_share_invites FOR ALL TO authenticated
  USING (can_manage_pet(pet_id) OR invited_by = auth.uid())
  WITH CHECK (can_manage_pet(pet_id));

CREATE OR REPLACE FUNCTION public.accept_pet_share(tok text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv pet_share_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sign_in_required');
  END IF;
  SELECT * INTO inv FROM pet_share_invites
   WHERE token = tok AND status = 'pending'
     AND (expires_at IS NULL OR expires_at > now());
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;
  INSERT INTO pet_relationships (pet_id, user_id, relationship, started_on)
  VALUES (inv.pet_id, auth.uid(), inv.level, current_date);
  UPDATE pet_share_invites
     SET status = 'accepted', accepted_user_id = auth.uid()
   WHERE id = inv.id;
  RETURN jsonb_build_object('ok', true, 'pet_id', inv.pet_id, 'level', inv.level);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_pet_share(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_pet_share(text) TO authenticated;

-- Caretaker may insert weight / care notes only
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='weight_entries') THEN
    EXECUTE 'DROP POLICY IF EXISTS we_caretaker_insert ON weight_entries';
    EXECUTE $p$
      CREATE POLICY we_caretaker_insert ON weight_entries FOR INSERT TO authenticated
      WITH CHECK (can_care_pet(pet_id))
    $p$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='pet_care_events') THEN
    EXECUTE 'DROP POLICY IF EXISTS pce_caretaker_insert ON pet_care_events';
    EXECUTE $p$
      CREATE POLICY pce_caretaker_insert ON pet_care_events FOR INSERT TO authenticated
      WITH CHECK (can_care_pet(pet_id) AND event_type IN ('weight','note','grooming','other'))
    $p$;
  END IF;
END $$;

-- Platform admin: manage any profile (block / role)
DROP POLICY IF EXISTS platform_admin_profiles ON profiles;
CREATE POLICY platform_admin_profiles ON profiles FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

CREATE TABLE IF NOT EXISTS bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id),
  title text,
  body text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','wontfix')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS br_own_insert ON bug_reports;
CREATE POLICY br_own_insert ON bug_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());
DROP POLICY IF EXISTS br_own_select ON bug_reports;
CREATE POLICY br_own_select ON bug_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR is_platform_admin());
DROP POLICY IF EXISTS br_admin_all ON bug_reports;
CREATE POLICY br_admin_all ON bug_reports FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS as_read ON app_settings;
CREATE POLICY as_read ON app_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS as_admin ON app_settings;
CREATE POLICY as_admin ON app_settings FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());
INSERT INTO app_settings (key, value) VALUES
  ('support_email', '"support.animals@rescue-army.com"'::jsonb),
  ('maintenance_message', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, postgres;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO supabase_auth_admin, postgres;
