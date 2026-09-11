-- Co-owner has the same Review/Apply + Run AI Health rights as owner.
-- Additive: CREATE OR REPLACE + DROP/CREATE policies only.

CREATE OR REPLACE FUNCTION public.can_write_pet_clinical(pid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pid IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM pets p WHERE p.id = pid AND p.owner_id = auth.uid()) THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pet_relationships pr
    WHERE pr.pet_id = pid
      AND pr.user_id = auth.uid()
      AND pr.ended_on IS NULL
      AND lower(pr.relationship) IN ('owner','own','co_owner','co-owner','veterinarian')
  ) THEN
    RETURN true;
  END IF;
  BEGIN
    IF public.is_platform_admin() THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;
  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_write_pet_clinical(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_pet_clinical(uuid) TO authenticated, postgres, PUBLIC;

-- Keep pet_rel_level in sync (co_owner distinct from caretaker).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'pet_rel_level'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.pet_rel_level(pid uuid)
      RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $q$
        SELECT CASE
          WHEN EXISTS (SELECT 1 FROM pets p WHERE p.id = pid AND p.owner_id = auth.uid()) THEN 'owner'
          WHEN EXISTS (
            SELECT 1 FROM pet_relationships pr
            WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
              AND lower(pr.relationship) IN ('owner','own')
          ) THEN 'owner'
          WHEN EXISTS (
            SELECT 1 FROM pet_relationships pr
            WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
              AND lower(pr.relationship) IN ('co_owner','co-owner')
          ) THEN 'co_owner'
          WHEN EXISTS (
            SELECT 1 FROM pet_relationships pr
            WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
              AND lower(pr.relationship) = 'veterinarian'
          ) THEN 'veterinarian'
          WHEN EXISTS (
            SELECT 1 FROM pet_relationships pr
            WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
              AND lower(pr.relationship) IN ('caretaker','foster')
          ) THEN 'caretaker'
          ELSE NULL
        END;
      $q$;
    $fn$;
  END IF;
END $$;

-- Owner-only insert policies → same gate as owner (can_write_pet_clinical).
DROP POLICY IF EXISTS pv_insert_as_owner ON pet_vaccinations;
CREATE POLICY pv_insert_as_owner ON pet_vaccinations
  FOR INSERT TO authenticated
  WITH CHECK (can_write_pet_clinical(pet_id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='lab_panels') THEN
    EXECUTE 'DROP POLICY IF EXISTS lp_insert_as_owner ON lab_panels';
    EXECUTE 'CREATE POLICY lp_insert_as_owner ON lab_panels FOR INSERT TO authenticated WITH CHECK (can_write_pet_clinical(pet_id))';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='lab_results' AND column_name='pet_id'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS lr_insert_as_owner ON lab_results';
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='lab_results' AND column_name='panel_id'
    ) THEN
      EXECUTE $p$
        CREATE POLICY lr_insert_as_owner ON lab_results FOR INSERT TO authenticated
        WITH CHECK (
          can_write_pet_clinical(pet_id)
          OR EXISTS (
            SELECT 1 FROM lab_panels lp
            WHERE lp.id = lab_results.panel_id AND can_write_pet_clinical(lp.pet_id)
          )
        )
      $p$;
    ELSE
      EXECUTE 'CREATE POLICY lr_insert_as_owner ON lab_results FOR INSERT TO authenticated WITH CHECK (can_write_pet_clinical(pet_id))';
    END IF;
  END IF;
END $$;

-- Tables that were owner_id-only (no clinical_vet_* policy).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['medications_given','pet_diagnostics','pet_vitals','pet_exams','pet_conditions','weight_entries','medical_records']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I_co_owner_write ON %I', t, t);
      EXECUTE format(
        'CREATE POLICY %I_co_owner_write ON %I FOR ALL TO authenticated USING (can_write_pet_clinical(pet_id)) WITH CHECK (can_write_pet_clinical(pet_id))',
        t, t
      );
    END IF;
  END LOOP;
END $$;

-- Run AI Health writes ai_health_analyses.
ALTER TABLE IF EXISTS ai_health_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aha_owner ON ai_health_analyses;
DROP POLICY IF EXISTS aha_write ON ai_health_analyses;
DROP POLICY IF EXISTS aha_update ON ai_health_analyses;
DROP POLICY IF EXISTS ai_health_analyses_medical ON ai_health_analyses;
DROP POLICY IF EXISTS aha_read ON ai_health_analyses;
CREATE POLICY aha_read ON ai_health_analyses FOR SELECT TO authenticated
  USING (can_read_pet_medical(pet_id) OR can_write_pet_clinical(pet_id));
CREATE POLICY aha_write ON ai_health_analyses FOR INSERT TO authenticated
  WITH CHECK (can_write_pet_clinical(pet_id));
CREATE POLICY aha_update ON ai_health_analyses FOR UPDATE TO authenticated
  USING (can_write_pet_clinical(pet_id)) WITH CHECK (can_write_pet_clinical(pet_id));

-- Review/Apply marks document_extractions applied.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='document_extractions') THEN
    EXECUTE 'DROP POLICY IF EXISTS de_write_clinical ON document_extractions';
    EXECUTE $p$
      CREATE POLICY de_write_clinical ON document_extractions FOR ALL TO authenticated
      USING (can_write_pet_clinical(pet_id))
      WITH CHECK (can_write_pet_clinical(pet_id))
    $p$;
  END IF;
END $$;
