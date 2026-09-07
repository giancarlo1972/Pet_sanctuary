-- Insurance: policies (any carrier, via PDF/AI or API) + claims. Idempotent.
CREATE TABLE IF NOT EXISTS insurance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  provider text NOT NULL,                 -- Lemonade, Healthy Paws, Trupanion...
  plan text,
  policy_number text,
  reimbursement_pct numeric,              -- 80
  deductible numeric,                     -- 250 (annual)
  annual_limit numeric,                   -- null = unlimited
  effective_from date, effective_to date,
  status text NOT NULL DEFAULT 'active',  -- active | lapsed | cancelled
  source text NOT NULL DEFAULT 'upload',  -- upload | api_lemonade | email
  document_id uuid REFERENCES pet_documents(id),
  external_ref text,                      -- carrier API id
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS insurance_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  title text NOT NULL,
  clinic text,
  service_date date,
  invoice_amount numeric,
  reimbursed_amount numeric,
  status text NOT NULL DEFAULT 'draft',   -- draft | submitted | in_review | reimbursed | denied
  invoice_document_id uuid REFERENCES pet_documents(id),
  external_ref text,
  submitted_at timestamptz, decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ip_rw ON insurance_policies;
CREATE POLICY ip_rw ON insurance_policies FOR ALL TO authenticated
  USING (can_read_pet_medical(pet_id)) WITH CHECK (can_read_pet_medical(pet_id));
DROP POLICY IF EXISTS ic_rw ON insurance_claims;
CREATE POLICY ic_rw ON insurance_claims FOR ALL TO authenticated
  USING (can_read_pet_medical(pet_id)) WITH CHECK (can_read_pet_medical(pet_id));

-- parse-pet-document: add kind 'insurance' to the schema →
-- { "insurance": { "provider", "plan", "policy_number", "insured_pet", "reimbursement_pct", "deductible",
--                  "annual_limit", "effective_from", "effective_to" } }
-- insert into insurance_policies with confirmed=false; UI shows "AI extracted — confirm before saving".
