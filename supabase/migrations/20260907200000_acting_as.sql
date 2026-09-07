-- Acting-as headers reduce privileges only; never grant. Writes still auth.uid().

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS acting_as text;

CREATE OR REPLACE FUNCTION public.acting_role()
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE h text; j json;
BEGIN
  h := current_setting('request.headers', true);
  IF h IS NULL OR btrim(h) = '' THEN RETURN NULL; END IF;
  j := h::json;
  RETURN nullif(lower(trim(coalesce(j ->> 'x-acting-role', ''))), '');
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.acting_org()
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  v := nullif(trim(coalesce(
    (nullif(current_setting('request.headers', true), '')::json ->> 'x-acting-org'),
    ''
  )), '');
  IF v IS NULL OR v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN v::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'platform_admin'
        AND coalesce(blocked, false) = false
    )
    AND coalesce(public.acting_role(), '') NOT IN ('org_admin', 'pet_admin', 'member');
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    coalesce(public.acting_role(), '') NOT IN ('pet_admin', 'member')
    AND (
      public.acting_org() IS NULL OR public.acting_org() = org
    )
    AND EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = org AND user_id = auth.uid() AND role = 'admin'
    )
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND coalesce(blocked, false) = false
    );
$$;
