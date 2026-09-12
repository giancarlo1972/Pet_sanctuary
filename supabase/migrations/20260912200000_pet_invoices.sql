-- Clinic invoices extracted from documents (Bills tile).
-- Distinct from public.invoices (org/sponsor ledger).
-- Paste once. Idempotent.

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
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pet_invoices_pet_date ON public.pet_invoices (pet_id, invoice_date DESC NULLS LAST);
CREATE UNIQUE INDEX IF NOT EXISTS pet_invoices_pet_no_date
  ON public.pet_invoices (pet_id, invoice_no, invoice_date)
  WHERE invoice_no IS NOT NULL AND invoice_date IS NOT NULL;

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

-- File a claim from an invoice even when no policy is on file yet.
ALTER TABLE public.insurance_claims
  ALTER COLUMN policy_id DROP NOT NULL;

ALTER TABLE public.insurance_claims
  ADD COLUMN IF NOT EXISTS pet_invoice_id uuid REFERENCES public.pet_invoices(id) ON DELETE SET NULL;
