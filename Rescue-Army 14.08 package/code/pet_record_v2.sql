-- Pet record v2: vaccinations w/ brand+dose+reactions, labs, documents, devices, AI analyses. Idempotent.

-- Weight: store ONE unit (lb). Fix rows mistakenly saved as kg (values < 12 for adult cats/dogs are suspicious; review before running the UPDATE).
ALTER TABLE pets ADD COLUMN IF NOT EXISTS weight_lb numeric;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS target_weight_lb numeric;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS colors text[];
ALTER TABLE pets ADD COLUMN IF NOT EXISTS ai_traits jsonb;      -- {species, breed_guess, confidence, life_stage, colors, coat}

CREATE TABLE IF NOT EXISTS weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  weight_lb numeric NOT NULL,
  source text NOT NULL DEFAULT 'manual',      -- manual | vet | device
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE TABLE IF NOT EXISTS vaccinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  vaccine text NOT NULL,                        -- Rabies, FVRCP, DHPP...
  brand text,                                   -- PUREVAX...
  dose text,                                    -- 1 mL
  lot_number text,
  route_site text,                              -- SC right rear
  given_on date NOT NULL,
  valid_until date,
  clinic text,
  vet_name text,
  reactions text,                               -- side effects observed
  document_id uuid,
  source text NOT NULL DEFAULT 'manual',        -- manual | ai_extracted | clinic
  confirmed boolean NOT NULL DEFAULT true,      -- ai_extracted rows start false until the owner confirms
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  panel text NOT NULL,                          -- Full check up, CBC, Chemistry
  analyte text NOT NULL,                        -- ALT, Creatinine, T4...
  value numeric,
  unit text,
  ref_low numeric, ref_high numeric,
  flag text,                                    -- low | normal | high
  taken_on date NOT NULL,
  clinic text,
  document_id uuid,
  source text NOT NULL DEFAULT 'manual',
  confirmed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pet_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  kind text NOT NULL,                           -- vaccine_record | lab_report | invoice | insurance | other
  storage_path text NOT NULL,                   -- private bucket 'pet-documents'
  title text,
  ai_status text NOT NULL DEFAULT 'pending',    -- pending | parsed | failed
  ai_summary jsonb,                             -- what Claude extracted (for review UI)
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pet_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  provider text NOT NULL,                       -- siipet | petkit | ...
  external_id text,
  label text,
  connected_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS device_readings (
  id bigserial PRIMARY KEY,
  device_id uuid NOT NULL REFERENCES pet_devices(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL,
  metric text NOT NULL,                         -- weight_lb | litter_visits | urination | stool_score
  value numeric,
  recorded_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_health_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  findings jsonb NOT NULL,                      -- [{severity, title, body}]
  inputs jsonb,                                 -- counts: labs, weights, events, device days
  model text,
  shared_with_vet_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: owner, org staff of the pet's shelter, or approved medical access request
CREATE OR REPLACE FUNCTION public.can_read_pet_medical(p uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM pets x WHERE x.id = p AND (
    x.owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = x.shelter_id AND om.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM shelter_members sm WHERE sm.shelter_id = x.shelter_id AND sm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM record_access_requests r WHERE r.pet_id = p AND r.requester_id = auth.uid()
               AND r.scope = 'medical' AND r.status = 'approved')));
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_pet_medical(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_pet_medical(uuid) TO authenticated;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['weight_entries','vaccinations','lab_results','pet_documents','pet_devices','device_readings','ai_health_analyses'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_rw ON %I', t, t);
    EXECUTE format('CREATE POLICY %I_rw ON %I FOR ALL TO authenticated USING (can_read_pet_medical(pet_id)) WITH CHECK (can_read_pet_medical(pet_id))', t, t);
  END LOOP;
END $$;
-- ai_health_analyses + device_readings are written by Edge Functions (service role); the client only reads.

-- Storage: create a PRIVATE bucket 'pet-documents'; read via createSignedUrl only.
-- Cleanup for Gina: remove placeholder vaccine row and fix kg-as-lb weights
-- DELETE FROM vaccinations WHERE pet_id = '<gina id>' AND given_on IS NULL;
-- UPDATE weight_entries SET weight_lb = round(weight_lb * 2.20462, 1) WHERE pet_id = '<gina id>' AND weight_lb < 12;
