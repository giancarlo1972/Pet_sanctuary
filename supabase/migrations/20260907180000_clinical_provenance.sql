-- Provenance on clinical tables + veterinarian relationship + vet_profiles.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.contype = 'c'
      AND n.nspname = 'public'
      AND cl.relname IN (
        'pet_vaccinations','pet_conditions','medical_records','lab_results',
        'pet_exams','medications_given','weight_entries','pet_relationships'
      )
      AND (c.conname ILIKE '%source%' OR c.conname ILIKE '%relationship%')
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', r.tbl, r.conname);
  END LOOP;
END $$;

DO $$
BEGIN
  ALTER TABLE pet_relationships ADD CONSTRAINT pet_relationships_relationship_check
    CHECK (relationship IN (
      'owner','own','foster','sponsor','sponsored','co_owner','co-owner',
      'caretaker','adopter','veterinarian'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN check_violation THEN
  -- keep check dropped so veterinarian can be inserted; leftover values stay
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.can_write_pet_clinical(pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pets p WHERE p.id = pid AND (
      p.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM pet_relationships pr
        WHERE pr.pet_id = p.id AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
          AND pr.relationship IN ('owner','own','veterinarian')
      )
      OR EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = p.shelter_id AND om.user_id = auth.uid()
      )
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_write_pet_clinical(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_pet_clinical(uuid) TO authenticated, postgres;

CREATE TABLE IF NOT EXISTS vet_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  license_number text,
  license_state text,
  clinic_id uuid,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vet_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vet_profiles_self ON vet_profiles;
CREATE POLICY vet_profiles_self ON vet_profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS vet_profiles_read ON vet_profiles;
CREATE POLICY vet_profiles_read ON vet_profiles FOR SELECT TO authenticated USING (true);

-- Columns + backfill per table
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'pet_vaccinations','pet_conditions','medical_records','lab_results',
    'pet_exams','medications_given','weight_entries'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS source text', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS author_id uuid', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS verified_by uuid', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS verified_at timestamptz', t);

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='source_document_id'
    ) THEN
      EXECUTE format($q$
        UPDATE %I SET source = CASE
          WHEN source IN ('ai','ai_extracted') THEN 'ai_extracted'
          WHEN source IN ('device','scale','litter','sensor') THEN 'device'
          WHEN source IN ('vet','veterinarian') THEN 'vet'
          WHEN source_document_id IS NOT NULL THEN 'ai_extracted'
          ELSE 'owner'
        END
      $q$, t);
    ELSE
      EXECUTE format($q$
        UPDATE %I SET source = CASE
          WHEN source IN ('ai','ai_extracted') THEN 'ai_extracted'
          WHEN source IN ('device','scale','litter','sensor') THEN 'device'
          WHEN source IN ('vet','veterinarian') THEN 'vet'
          ELSE 'owner'
        END
      $q$, t);
    END IF;

    EXECUTE format($q$ UPDATE %I SET source = 'owner' WHERE source IS NULL $q$, t);
    EXECUTE format($q$ ALTER TABLE %I ALTER COLUMN source SET DEFAULT 'owner' $q$, t);

    BEGIN
      EXECUTE format($q$
        ALTER TABLE %I ADD CONSTRAINT %I CHECK (source IN ('vet','ai_extracted','owner','device'))
      $q$, t, t || '_source_check');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- copy recorded_by → author_id when present
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='recorded_by'
    ) THEN
      EXECUTE format($q$ UPDATE %I SET author_id = recorded_by WHERE author_id IS NULL AND recorded_by IS NOT NULL $q$, t);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pet_vaccinations' AND column_name='source_document_id') THEN
    UPDATE pet_vaccinations SET source = 'ai_extracted' WHERE source_document_id IS NOT NULL AND source IS DISTINCT FROM 'ai_extracted';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pet_conditions' AND column_name='source_document_id') THEN
    UPDATE pet_conditions SET source = 'ai_extracted' WHERE source_document_id IS NOT NULL AND source IS DISTINCT FROM 'ai_extracted';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pet_exams' AND column_name='source_document_id') THEN
    UPDATE pet_exams SET source = 'ai_extracted' WHERE source_document_id IS NOT NULL AND source IS DISTINCT FROM 'ai_extracted';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='medications_given' AND column_name='source_document_id') THEN
    UPDATE medications_given SET source = 'ai_extracted' WHERE source_document_id IS NOT NULL AND source IS DISTINCT FROM 'ai_extracted';
  END IF;
END $$;

DROP POLICY IF EXISTS clinical_vet_vax ON pet_vaccinations;
CREATE POLICY clinical_vet_vax ON pet_vaccinations FOR ALL TO authenticated
  USING (can_write_pet_clinical(pet_id)) WITH CHECK (can_write_pet_clinical(pet_id));

DROP POLICY IF EXISTS clinical_vet_cond ON pet_conditions;
CREATE POLICY clinical_vet_cond ON pet_conditions FOR ALL TO authenticated
  USING (can_write_pet_clinical(pet_id)) WITH CHECK (can_write_pet_clinical(pet_id));

DROP POLICY IF EXISTS clinical_vet_medrec ON medical_records;
CREATE POLICY clinical_vet_medrec ON medical_records FOR ALL TO authenticated
  USING (can_write_pet_clinical(pet_id)) WITH CHECK (can_write_pet_clinical(pet_id));

DROP POLICY IF EXISTS clinical_vet_labs ON lab_results;
CREATE POLICY clinical_vet_labs ON lab_results FOR ALL TO authenticated
  USING (can_write_pet_clinical(pet_id)) WITH CHECK (can_write_pet_clinical(pet_id));

DROP POLICY IF EXISTS clinical_vet_exams ON pet_exams;
CREATE POLICY clinical_vet_exams ON pet_exams FOR ALL TO authenticated
  USING (can_write_pet_clinical(pet_id)) WITH CHECK (can_write_pet_clinical(pet_id));

DROP POLICY IF EXISTS clinical_vet_meds ON medications_given;
CREATE POLICY clinical_vet_meds ON medications_given FOR ALL TO authenticated
  USING (can_write_pet_clinical(pet_id)) WITH CHECK (can_write_pet_clinical(pet_id));

DROP POLICY IF EXISTS clinical_vet_wt ON weight_entries;
CREATE POLICY clinical_vet_wt ON weight_entries FOR ALL TO authenticated
  USING (can_write_pet_clinical(pet_id)) WITH CHECK (can_write_pet_clinical(pet_id));
