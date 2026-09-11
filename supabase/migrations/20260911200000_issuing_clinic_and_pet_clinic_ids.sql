-- Document-level issuing clinic (letterhead) plus clinic chart IDs.
-- Paste once. Idempotent.

ALTER TABLE public.pet_documents
  ADD COLUMN IF NOT EXISTS issuing_clinic text;

COMMENT ON COLUMN public.pet_documents.issuing_clinic IS
  'Practice in the letterhead/header (logo BondVet, Medical Chart title). Rows inherit this unless a Service block names another provider.';

CREATE TABLE IF NOT EXISTS public.pet_clinic_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  clinic text NOT NULL,
  patient_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pet_id, clinic)
);

ALTER TABLE public.pet_clinic_ids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pet_clinic_ids_read ON public.pet_clinic_ids;
CREATE POLICY pet_clinic_ids_read ON public.pet_clinic_ids
  FOR SELECT TO authenticated
  USING (can_read_pet_medical(pet_id));

DROP POLICY IF EXISTS pet_clinic_ids_write ON public.pet_clinic_ids;
CREATE POLICY pet_clinic_ids_write ON public.pet_clinic_ids
  FOR ALL TO authenticated
  USING (can_write_pet_clinical(pet_id))
  WITH CHECK (can_write_pet_clinical(pet_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pet_clinic_ids TO authenticated;
GRANT ALL ON public.pet_clinic_ids TO service_role;
