-- Re-process / coalesce derived rows + pet photo focal point.
-- Labs key (pet, analyte, collected_on, clinic); vaccines (pet, type, administered_on ±3d)
-- with superseded_by; visits (pet, clinic, visit_date) + visit_type including telehealth.
--
-- Also bootstraps public.pet_invoices if 20260912200000 was never applied.
-- Paste once. Idempotent. Safe when pet_invoices (or any listed table) is missing.

-- ---------------------------------------------------------------------------
-- 0. pet_invoices (Bills tile) — create first so later ALTER/DELETE never 42P01
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pet_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.pet_documents(id) ON DELETE SET NULL,
  clinic text,
  invoice_date date,
  invoice_no text,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric,
  tax numeric,
  total numeric,
  paid boolean,
  source text,
  author_id uuid,
  document_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pet_invoices_pet_date ON public.pet_invoices (pet_id, invoice_date DESC NULLS LAST);

-- Unique (pet, invoice_no, date) only after duplicates are collapsed.
-- A leftover 23505 here used to abort the whole paste (photo_focal + RPCs never landed).
DO $$
BEGIN
  IF to_regclass('public.pet_invoices') IS NULL THEN RETURN; END IF;
  DELETE FROM public.pet_invoices a
  USING public.pet_invoices b
  WHERE a.pet_id = b.pet_id
    AND a.invoice_no IS NOT NULL
    AND a.invoice_date IS NOT NULL
    AND a.invoice_no = b.invoice_no
    AND a.invoice_date = b.invoice_date
    AND (a.created_at, a.ctid) < (b.created_at, b.ctid);
  BEGIN
    EXECUTE $i$
      CREATE UNIQUE INDEX IF NOT EXISTS pet_invoices_pet_no_date
        ON public.pet_invoices (pet_id, invoice_no, invoice_date)
        WHERE invoice_no IS NOT NULL AND invoice_date IS NOT NULL
    $i$;
  EXCEPTION WHEN unique_violation THEN NULL;
  WHEN duplicate_table THEN NULL;
  END;
END $$;

ALTER TABLE public.pet_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pet_invoices_read ON public.pet_invoices;
CREATE POLICY pet_invoices_read ON public.pet_invoices
  FOR SELECT TO authenticated
  USING (can_read_pet_medical(pet_id));

DROP POLICY IF EXISTS pet_invoices_write ON public.pet_invoices;
CREATE POLICY pet_invoices_write ON public.pet_invoices
  FOR ALL TO authenticated
  USING (can_write_pet_clinical(pet_id))
  WITH CHECK (can_write_pet_clinical(pet_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pet_invoices TO authenticated;
GRANT ALL ON public.pet_invoices TO service_role;

DO $$
BEGIN
  IF to_regclass('public.insurance_claims') IS NULL THEN RETURN; END IF;
  BEGIN
    EXECUTE 'ALTER TABLE public.insurance_claims ALTER COLUMN policy_id DROP NOT NULL';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS pet_invoice_id uuid REFERENCES public.pet_invoices(id) ON DELETE SET NULL';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Additive columns (skip a table if this project does not have it)
-- ---------------------------------------------------------------------------
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS photo_focal jsonb;

DO $$
DECLARE
  stmt text;
BEGIN
  FOREACH stmt IN ARRAY ARRAY[
    'ALTER TABLE public.pet_vaccinations ADD COLUMN IF NOT EXISTS superseded_by uuid',
    'ALTER TABLE public.pet_vaccinations ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT ''{}''',
    'ALTER TABLE public.pet_vaccinations ADD COLUMN IF NOT EXISTS source_document_id uuid',
    'ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS analyte text',
    'ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT ''{}''',
    'ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS source_document_id uuid',
    'ALTER TABLE public.pet_exams ADD COLUMN IF NOT EXISTS visit_type text',
    'ALTER TABLE public.pet_exams ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT ''{}''',
    'ALTER TABLE public.pet_exams ADD COLUMN IF NOT EXISTS owner_instructions text',
    'ALTER TABLE public.pet_exams ADD COLUMN IF NOT EXISTS plan text',
    'ALTER TABLE public.pet_exams ADD COLUMN IF NOT EXISTS notes text',
    'ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS clinic text',
    'ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS visit_type text',
    'ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT ''{}''',
    'ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS source_document_id uuid',
    'ALTER TABLE public.weight_entries ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT ''{}''',
    'ALTER TABLE public.weight_entries ADD COLUMN IF NOT EXISTS source_document_id uuid',
    'ALTER TABLE public.medications_given ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT ''{}''',
    'ALTER TABLE public.pet_diagnostics ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT ''{}''',
    'ALTER TABLE public.pet_conditions ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT ''{}''',
    'ALTER TABLE public.pet_invoices ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT ''{}'''
  ]
  LOOP
    BEGIN
      EXECUTE stmt;
    EXCEPTION WHEN undefined_table THEN NULL;
    END;
  END LOOP;
END $$;

UPDATE public.lab_results SET analyte = name WHERE analyte IS NULL AND name IS NOT NULL;

UPDATE public.pet_vaccinations
SET document_ids = ARRAY[source_document_id]
WHERE source_document_id IS NOT NULL
  AND (document_ids IS NULL OR cardinality(document_ids) = 0);

UPDATE public.lab_results
SET document_ids = ARRAY[source_document_id]
WHERE source_document_id IS NOT NULL
  AND (document_ids IS NULL OR cardinality(document_ids) = 0);

UPDATE public.pet_exams
SET document_ids = ARRAY[source_document_id]
WHERE source_document_id IS NOT NULL
  AND (document_ids IS NULL OR cardinality(document_ids) = 0);

DO $$
BEGIN
  UPDATE public.pet_invoices
  SET document_ids = ARRAY[document_id]
  WHERE document_id IS NOT NULL
    AND (document_ids IS NULL OR cardinality(document_ids) = 0);
EXCEPTION WHEN undefined_table THEN NULL; WHEN undefined_column THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.pet_exams DROP CONSTRAINT IF EXISTS pet_exams_visit_type_check;
  ALTER TABLE public.pet_exams ADD CONSTRAINT pet_exams_visit_type_check
    CHECK (visit_type IS NULL OR visit_type IN ('in_person', 'telehealth', 'house_call'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.medical_records DROP CONSTRAINT IF EXISTS medical_records_visit_type_check;
  ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_visit_type_check
    CHECK (visit_type IS NULL OR visit_type IN ('in_person', 'telehealth', 'house_call'));
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS lab_results_coalesce_idx
  ON public.lab_results (pet_id, collected_on, lower(coalesce(analyte, name)));

CREATE INDEX IF NOT EXISTS pet_vaccinations_coalesce_idx
  ON public.pet_vaccinations (pet_id, vaccine_type, administered_on);

CREATE INDEX IF NOT EXISTS pet_exams_coalesce_idx
  ON public.pet_exams (pet_id, visit_date, clinic);

CREATE INDEX IF NOT EXISTS medical_records_coalesce_idx
  ON public.medical_records (pet_id, record_date, clinic);

-- ---------------------------------------------------------------------------
-- 2. Re-process RPCs — skip any table/column this project does not have
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_ai_extracted_for_pet(pid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_pet_clinical(pid) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  FOREACH t IN ARRAY ARRAY[
    'pet_vaccinations','lab_results','medical_records','pet_exams',
    'weight_entries','medications_given','pet_conditions','pet_invoices'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'source'
    ) THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE pet_id = $1 AND source = ''ai_extracted''',
        t
      ) USING pid;
    END IF;
  END LOOP;
  IF to_regclass('public.pet_diagnostics') IS NOT NULL THEN
    DELETE FROM public.pet_diagnostics WHERE pet_id = pid AND source_document_id IS NOT NULL;
  END IF;
  IF to_regclass('public.pet_vitals') IS NOT NULL THEN
    DELETE FROM public.pet_vitals WHERE pet_id = pid AND source_document_id IS NOT NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.detach_document_derived(pid uuid, doc uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t text;
        has_source boolean;
        has_src_doc boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_pet_clinical(pid) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  FOREACH t IN ARRAY ARRAY[
    'pet_vaccinations','lab_results','medical_records','pet_exams',
    'weight_entries','medications_given','pet_diagnostics','pet_conditions','pet_invoices'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'document_ids'
    ) THEN
      CONTINUE;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'source'
    ) INTO has_source;
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'source_document_id'
    ) INTO has_src_doc;
    IF has_source THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE pet_id = $1 AND coalesce(source, ''ai_extracted'') = ''ai_extracted'' AND document_ids = ARRAY[$2]::uuid[]',
        t
      ) USING pid, doc;
    ELSE
      EXECUTE format(
        'DELETE FROM public.%I WHERE pet_id = $1 AND document_ids = ARRAY[$2]::uuid[]',
        t
      ) USING pid, doc;
    END IF;
    EXECUTE format(
      'UPDATE public.%I SET document_ids = array_remove(document_ids, $2) WHERE pet_id = $1 AND $2 = ANY(document_ids)',
      t
    ) USING pid, doc;
    IF has_src_doc AND has_source THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE pet_id = $1 AND source_document_id = $2 AND coalesce(source, ''ai_extracted'') = ''ai_extracted'' AND (document_ids IS NULL OR cardinality(document_ids) = 0)',
        t
      ) USING pid, doc;
    ELSIF has_src_doc THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE pet_id = $1 AND source_document_id = $2 AND (document_ids IS NULL OR cardinality(document_ids) = 0)',
        t
      ) USING pid, doc;
    END IF;
  END LOOP;
  IF to_regclass('public.pet_vitals') IS NOT NULL THEN
    DELETE FROM public.pet_vitals WHERE pet_id = pid AND source_document_id = doc;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_ai_extracted_for_pet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_ai_extracted_for_pet(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.detach_document_derived(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.detach_document_derived(uuid, uuid) TO authenticated;
