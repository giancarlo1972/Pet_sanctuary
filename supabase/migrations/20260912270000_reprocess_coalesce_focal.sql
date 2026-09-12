-- Re-process / coalesce derived rows + pet photo focal point.
-- Labs key (pet, analyte, collected_on, clinic); vaccines (pet, type, administered_on ±3d)
-- with superseded_by; visits (pet, clinic, visit_date) + visit_type including telehealth.

ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS photo_focal jsonb;

ALTER TABLE public.pet_vaccinations ADD COLUMN IF NOT EXISTS superseded_by uuid;
ALTER TABLE public.pet_vaccinations ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.pet_vaccinations ADD COLUMN IF NOT EXISTS source_document_id uuid;

ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS analyte text;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS source_document_id uuid;

ALTER TABLE public.pet_exams ADD COLUMN IF NOT EXISTS visit_type text;
ALTER TABLE public.pet_exams ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.pet_exams ADD COLUMN IF NOT EXISTS owner_instructions text;
ALTER TABLE public.pet_exams ADD COLUMN IF NOT EXISTS plan text;
ALTER TABLE public.pet_exams ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS clinic text;
ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS visit_type text;
ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.medical_records ADD COLUMN IF NOT EXISTS source_document_id uuid;

ALTER TABLE public.weight_entries ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.weight_entries ADD COLUMN IF NOT EXISTS source_document_id uuid;

ALTER TABLE public.medications_given ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.pet_diagnostics ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.pet_conditions ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.pet_invoices ADD COLUMN IF NOT EXISTS document_ids uuid[] NOT NULL DEFAULT '{}';

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
  ALTER TABLE public.pet_exams DROP CONSTRAINT IF EXISTS pet_exams_visit_type_check;
  ALTER TABLE public.pet_exams ADD CONSTRAINT pet_exams_visit_type_check
    CHECK (visit_type IS NULL OR visit_type IN ('in_person', 'telehealth', 'house_call'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.medical_records DROP CONSTRAINT IF EXISTS medical_records_visit_type_check;
  ALTER TABLE public.medical_records ADD CONSTRAINT medical_records_visit_type_check
    CHECK (visit_type IS NULL OR visit_type IN ('in_person', 'telehealth', 'house_call'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS lab_results_coalesce_idx
  ON public.lab_results (pet_id, collected_on, lower(coalesce(analyte, name)));

CREATE INDEX IF NOT EXISTS pet_vaccinations_coalesce_idx
  ON public.pet_vaccinations (pet_id, vaccine_type, administered_on);

CREATE INDEX IF NOT EXISTS pet_exams_coalesce_idx
  ON public.pet_exams (pet_id, visit_date, clinic);

CREATE INDEX IF NOT EXISTS medical_records_coalesce_idx
  ON public.medical_records (pet_id, record_date, clinic);

CREATE OR REPLACE FUNCTION public.clear_ai_extracted_for_pet(pid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_pet_clinical(pid) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  DELETE FROM public.pet_vaccinations WHERE pet_id = pid AND source = 'ai_extracted';
  DELETE FROM public.lab_results WHERE pet_id = pid AND source = 'ai_extracted';
  DELETE FROM public.medical_records WHERE pet_id = pid AND source = 'ai_extracted';
  DELETE FROM public.pet_exams WHERE pet_id = pid AND source = 'ai_extracted';
  DELETE FROM public.weight_entries WHERE pet_id = pid AND source = 'ai_extracted';
  DELETE FROM public.medications_given WHERE pet_id = pid AND source = 'ai_extracted';
  DELETE FROM public.pet_diagnostics WHERE pet_id = pid AND source_document_id IS NOT NULL;
  DELETE FROM public.pet_vitals WHERE pet_id = pid AND source_document_id IS NOT NULL;
  DELETE FROM public.pet_invoices WHERE pet_id = pid AND source = 'ai_extracted';
  DELETE FROM public.pet_conditions WHERE pet_id = pid AND source = 'ai_extracted';
END;
$$;

CREATE OR REPLACE FUNCTION public.detach_document_derived(pid uuid, doc uuid)
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
    'weight_entries','medications_given','pet_diagnostics','pet_conditions','pet_invoices'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'document_ids'
    ) THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'DELETE FROM public.%I WHERE pet_id = $1 AND coalesce(source, ''ai_extracted'') = ''ai_extracted'' AND document_ids = ARRAY[$2]::uuid[]',
      t
    ) USING pid, doc;
    EXECUTE format(
      'UPDATE public.%I SET document_ids = array_remove(document_ids, $2) WHERE pet_id = $1 AND $2 = ANY(document_ids)',
      t
    ) USING pid, doc;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'source_document_id'
    ) THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE pet_id = $1 AND source_document_id = $2 AND coalesce(source, ''ai_extracted'') = ''ai_extracted'' AND (document_ids IS NULL OR cardinality(document_ids) = 0)',
        t
      ) USING pid, doc;
    END IF;
  END LOOP;
  DELETE FROM public.pet_vitals WHERE pet_id = pid AND source_document_id = doc;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_ai_extracted_for_pet(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_ai_extracted_for_pet(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.detach_document_derived(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.detach_document_derived(uuid, uuid) TO authenticated;
