/*
# Identity & Records: Microchip, Medical Records, Adoption History, Access Control

## Summary
Adds microchip number to pets (masked unless org member), creates adoption_history
and record_access_requests/record_access_log tables, tightens medical_records RLS,
protects EIN on organizations, and creates SECURITY DEFINER RPCs for all privileged reads.

## New Tables
- adoption_history: pet_id, period, event (adopted|returned|foster_placement), note, org_id
- record_access_requests: pet_id, requester_id, scope (microchip|medical), status (pending|approved|denied)
- record_access_log: record_type, record_id, viewer_id, viewed_at (no client access)

## Modified Tables
- pets: + microchip_number text (column SELECT revoked from anon, authenticated)
- medical_records: + notes text (RLS tightened to org members + approved fosters)
- reports: + pet_id uuid (for linked reports on pet detail)
- organizations: ein column SELECT revoked from anon, authenticated

## Security
- Microchip: only visible via get_pet_microchip() RPC — full for org members, masked for everyone else
- EIN: only visible via get_org_ein() RPC — full for related users (member/donor/follower/approved foster), masked for everyone else
- Medical records: RLS restricts to org members or fosters with approved record_access_requests
- Adoption history: RLS restricts to org members; public gets count via get_adoption_count()
- record_access_log: RLS enabled, no policies = no client access; SECURITY DEFINER functions insert logs
- record_access_requests: requester inserts own (status forced 'pending'); org members update status
- Trigger auto-sets decided_by and decided_at when status changes

## RPC Functions
- get_pet_microchip(p_pet_id): full or masked microchip, logs access
- get_org_ein(p_org_id): full or masked EIN
- get_medical_records(p_pet_id): records for org members/approved fosters, logs access
- get_adoption_history(p_pet_id): history for org members, logs access
- get_adoption_count(p_pet_id): public count
- log_record_access(): internal helper, no client grants
*/

-- =========================================================
-- 1. Column additions
-- =========================================================

ALTER TABLE pets ADD COLUMN IF NOT EXISTS microchip_number text;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS pet_id uuid;

-- =========================================================
-- 2. New tables
-- =========================================================

CREATE TABLE IF NOT EXISTS adoption_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  period text,
  event text NOT NULL CHECK (event IN ('adopted', 'returned', 'foster_placement')),
  note text,
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS record_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('microchip', 'medical')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  decided_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS record_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_type text NOT NULL,
  record_id uuid NOT NULL,
  viewer_id uuid,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 3. Enable RLS on all new tables
-- =========================================================

ALTER TABLE adoption_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_access_log ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- 4. Medical records RLS — drop old, create tightened policies
-- =========================================================

DROP POLICY IF EXISTS "read_medical_records" ON medical_records;
DROP POLICY IF EXISTS "insert_medical_records" ON medical_records;

CREATE POLICY "medical_records_select_authorized" ON medical_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = medical_records.pet_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM shelter_members sm WHERE sm.shelter_id = p.shelter_id AND sm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = p.shelter_id AND om.user_id = auth.uid())
        OR EXISTS (
          SELECT 1 FROM record_access_requests rar
          WHERE rar.pet_id = medical_records.pet_id
          AND rar.requester_id = auth.uid()
          AND rar.scope = 'medical'
          AND rar.status = 'approved'
        )
      )
    )
  );

CREATE POLICY "medical_records_insert_org_members" ON medical_records
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = medical_records.pet_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM shelter_members sm WHERE sm.shelter_id = p.shelter_id AND sm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = p.shelter_id AND om.user_id = auth.uid())
      )
    )
  );

-- =========================================================
-- 5. Adoption history RLS — org members only
-- =========================================================

DROP POLICY IF EXISTS "adoption_history_select_org" ON adoption_history;
CREATE POLICY "adoption_history_select_org" ON adoption_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = adoption_history.pet_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM shelter_members sm WHERE sm.shelter_id = p.shelter_id AND sm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = p.shelter_id AND om.user_id = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "adoption_history_insert_org" ON adoption_history;
CREATE POLICY "adoption_history_insert_org" ON adoption_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = adoption_history.pet_id
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM shelter_members sm WHERE sm.shelter_id = p.shelter_id AND sm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = p.shelter_id AND om.user_id = auth.uid())
      )
    )
  );

-- =========================================================
-- 6. Record access requests RLS
-- =========================================================

-- Requesters read their own
DROP POLICY IF EXISTS "rar_select_own" ON record_access_requests;
CREATE POLICY "rar_select_own" ON record_access_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid());

-- Org members read requests for their pets
DROP POLICY IF EXISTS "rar_select_org" ON record_access_requests;
CREATE POLICY "rar_select_org" ON record_access_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = record_access_requests.pet_id
      AND (
        EXISTS (SELECT 1 FROM shelter_members sm WHERE sm.shelter_id = p.shelter_id AND sm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = p.shelter_id AND om.user_id = auth.uid())
      )
    )
  );

-- Fosters insert their own (status forced pending)
DROP POLICY IF EXISTS "rar_insert_own" ON record_access_requests;
CREATE POLICY "rar_insert_own" ON record_access_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending');

-- Org members update status
DROP POLICY IF EXISTS "rar_update_org" ON record_access_requests;
CREATE POLICY "rar_update_org" ON record_access_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = record_access_requests.pet_id
      AND (
        EXISTS (SELECT 1 FROM shelter_members sm WHERE sm.shelter_id = p.shelter_id AND sm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = p.shelter_id AND om.user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pets p
      WHERE p.id = record_access_requests.pet_id
      AND (
        EXISTS (SELECT 1 FROM shelter_members sm WHERE sm.shelter_id = p.shelter_id AND sm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = p.shelter_id AND om.user_id = auth.uid())
      )
    )
  );

-- =========================================================
-- 7. Record access log — no client policies (locked down)
-- =========================================================
-- RLS enabled with no policies = no client read/write.
-- SECURITY DEFINER functions bypass RLS to insert logs.

-- =========================================================
-- 8. Column-level revokes for sensitive data
-- =========================================================

REVOKE SELECT (microchip_number) ON pets FROM anon;
REVOKE SELECT (microchip_number) ON pets FROM authenticated;

REVOKE SELECT (ein) ON organizations FROM anon;
REVOKE SELECT (ein) ON organizations FROM authenticated;

-- =========================================================
-- 9. Helper: log_record_access (internal, no client grants)
-- =========================================================

CREATE OR REPLACE FUNCTION log_record_access(p_record_type text, p_record_id uuid, p_viewer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO record_access_log (record_type, record_id, viewer_id, viewed_at)
  VALUES (p_record_type, p_record_id, p_viewer_id, now());
END;
$$;

REVOKE EXECUTE ON FUNCTION log_record_access FROM anon, authenticated;

-- =========================================================
-- 10. RPC: get_pet_microchip
--     Full for org members/owners; masked for everyone else
-- =========================================================

CREATE OR REPLACE FUNCTION get_pet_microchip(p_pet_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_microchip text;
  v_shelter_id uuid;
  v_is_member boolean := false;
BEGIN
  SELECT microchip_number, shelter_id INTO v_microchip, v_shelter_id
  FROM pets WHERE id = p_pet_id;

  IF v_microchip IS NULL THEN RETURN NULL; END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM shelter_members WHERE shelter_id = v_shelter_id AND user_id = auth.uid()
    ) OR EXISTS(
      SELECT 1 FROM organization_members WHERE organization_id = v_shelter_id AND user_id = auth.uid()
    ) OR EXISTS(
      SELECT 1 FROM pets WHERE id = p_pet_id AND owner_id = auth.uid()
    ) INTO v_is_member;
  END IF;

  PERFORM log_record_access('microchip', p_pet_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));

  IF v_is_member THEN
    RETURN v_microchip;
  ELSE
    RETURN '••• ••• ' || RIGHT(v_microchip, 3);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_pet_microchip TO anon, authenticated;

-- =========================================================
-- 11. RPC: get_org_ein
--     Full for related users; masked for everyone else
-- =========================================================

CREATE OR REPLACE FUNCTION get_org_ein(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ein text;
  v_has_rel boolean := false;
BEGIN
  SELECT ein INTO v_ein FROM organizations WHERE id = p_org_id;
  IF v_ein IS NULL THEN RETURN NULL; END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM organization_members WHERE organization_id = p_org_id AND user_id = auth.uid()
    ) OR EXISTS(
      SELECT 1 FROM organizations WHERE id = p_org_id AND created_by = auth.uid()
    ) OR EXISTS(
      SELECT 1 FROM donations WHERE shelter_id = p_org_id AND donor_id = auth.uid()
    ) OR EXISTS(
      SELECT 1 FROM favorites WHERE target_id = p_org_id AND target_type = 'organization' AND user_id = auth.uid()
    ) OR EXISTS(
      SELECT 1 FROM record_access_requests rar
      JOIN pets p ON p.id = rar.pet_id AND p.shelter_id = p_org_id
      WHERE rar.requester_id = auth.uid() AND rar.status = 'approved'
    ) INTO v_has_rel;
  END IF;

  IF v_has_rel THEN
    RETURN v_ein;
  ELSE
    RETURN '••-••' || RIGHT(v_ein, 5);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION get_org_ein TO anon, authenticated;

-- =========================================================
-- 12. RPC: get_medical_records
--     Returns records only for org members/approved fosters; logs access
-- =========================================================

CREATE OR REPLACE FUNCTION get_medical_records(p_pet_id uuid)
RETURNS TABLE (
  id uuid,
  record_date date,
  title text,
  vet_org_id uuid,
  notes text,
  provider_name text
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_shelter_id uuid;
  v_can_read boolean := false;
BEGIN
  SELECT shelter_id INTO v_shelter_id FROM pets WHERE id = p_pet_id;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM shelter_members WHERE shelter_id = v_shelter_id AND user_id = auth.uid()
    ) OR EXISTS(
      SELECT 1 FROM organization_members WHERE organization_id = v_shelter_id AND user_id = auth.uid()
    ) OR EXISTS(
      SELECT 1 FROM pets WHERE id = p_pet_id AND owner_id = auth.uid()
    ) OR EXISTS(
      SELECT 1 FROM record_access_requests
      WHERE pet_id = p_pet_id AND requester_id = auth.uid() AND scope = 'medical' AND status = 'approved'
    ) INTO v_can_read;
  END IF;

  IF NOT v_can_read THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  PERFORM log_record_access('medical_records', p_pet_id, auth.uid());

  RETURN QUERY
  SELECT mr.id, mr.record_date, mr.title, mr.vet_org_id, mr.notes,
         o.name
  FROM medical_records mr
  LEFT JOIN organizations o ON o.id = mr.vet_org_id
  WHERE mr.pet_id = p_pet_id
  ORDER BY mr.record_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_medical_records TO authenticated;
REVOKE EXECUTE ON FUNCTION get_medical_records FROM anon;

-- =========================================================
-- 13. RPC: get_adoption_history
--     Returns history only for org members; logs access
-- =========================================================

CREATE OR REPLACE FUNCTION get_adoption_history(p_pet_id uuid)
RETURNS TABLE (
  id uuid,
  period text,
  event text,
  note text,
  org_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_shelter_id uuid;
  v_can_read boolean := false;
BEGIN
  SELECT shelter_id INTO v_shelter_id FROM pets WHERE id = p_pet_id;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM shelter_members WHERE shelter_id = v_shelter_id AND user_id = auth.uid()
    ) OR EXISTS(
      SELECT 1 FROM organization_members WHERE organization_id = v_shelter_id AND user_id = auth.uid()
    ) OR EXISTS(
      SELECT 1 FROM pets WHERE id = p_pet_id AND owner_id = auth.uid()
    ) INTO v_can_read;
  END IF;

  IF NOT v_can_read THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  PERFORM log_record_access('adoption_history', p_pet_id, auth.uid());

  RETURN QUERY
  SELECT ah.id, ah.period, ah.event, ah.note, ah.org_id, ah.created_at
  FROM adoption_history ah
  WHERE ah.pet_id = p_pet_id
  ORDER BY ah.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_adoption_history TO authenticated;
REVOKE EXECUTE ON FUNCTION get_adoption_history FROM anon;

-- =========================================================
-- 14. RPC: get_adoption_count (public)
-- =========================================================

CREATE OR REPLACE FUNCTION get_adoption_count(p_pet_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM adoption_history WHERE pet_id = p_pet_id;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_adoption_count TO anon, authenticated;

-- =========================================================
-- 15. Trigger: auto-set decided_by and decided_at on record_access_requests
-- =========================================================

CREATE OR REPLACE FUNCTION set_rar_decided()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'denied') THEN
    NEW.decided_by = auth.uid();
    NEW.decided_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rar_set_decided ON record_access_requests;
CREATE TRIGGER rar_set_decided
  BEFORE UPDATE ON record_access_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_rar_decided();

-- =========================================================
-- 16. Indexes
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_adoption_history_pet_id ON adoption_history(pet_id);
CREATE INDEX IF NOT EXISTS idx_record_access_requests_pet_id ON record_access_requests(pet_id);
CREATE INDEX IF NOT EXISTS idx_record_access_requests_requester ON record_access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_record_access_log_record ON record_access_log(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_reports_pet_id ON reports(pet_id);
