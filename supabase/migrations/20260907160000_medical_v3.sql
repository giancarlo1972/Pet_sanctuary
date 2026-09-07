CREATE TABLE IF NOT EXISTS medications_given (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose text,
  route text,
  administered_on date,
  status text NOT NULL DEFAULT 'active',
  source_document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medications_given_pet ON medications_given (pet_id, administered_on DESC);
ALTER TABLE medications_given ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS meds_given_all ON medications_given;
CREATE POLICY meds_given_all ON medications_given FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pets p WHERE p.id = medications_given.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pets p WHERE p.id = medications_given.pet_id AND p.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS pet_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other',
  name text NOT NULL,
  result text,
  taken_on date,
  source_document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pet_diagnostics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS diag_all ON pet_diagnostics;
CREATE POLICY diag_all ON pet_diagnostics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pets p WHERE p.id = pet_diagnostics.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pets p WHERE p.id = pet_diagnostics.pet_id AND p.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS pet_vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  recorded_at timestamptz NOT NULL,
  temp_f numeric,
  hr numeric,
  rr numeric,
  weight_lb numeric,
  bcs numeric,
  source_document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pet_vitals_pet ON pet_vitals (pet_id, recorded_at);
ALTER TABLE pet_vitals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vitals_all ON pet_vitals;
CREATE POLICY vitals_all ON pet_vitals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pets p WHERE p.id = pet_vitals.pet_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pets p WHERE p.id = pet_vitals.pet_id AND p.owner_id = auth.uid()));

ALTER TABLE lab_analytes ADD COLUMN IF NOT EXISTS panel_group text;

INSERT INTO lab_analytes (name, unit, species, ref_low, ref_high, aliases, panel_group) VALUES
  ('CK', 'U/L', 'both', 10, 200, ARRAY['cpk','creatine kinase'], 'chemistry'),
  ('Triglycerides', 'mg/dL', 'both', 20, 120, ARRAY['trig','triglyceride'], 'chemistry'),
  ('Spec fPL', 'µg/L', 'feline', 0, 3.5, ARRAY['fpl','spec fpl','pancreatic lipase'], 'endocrinology'),
  ('PCV', '%', 'both', 30, 45, ARRAY['packed cell volume'], 'hematology'),
  ('Total Solids', 'g/dL', 'both', 6.0, 8.5, ARRAY['ts','total solids','plasma protein'], 'hematology'),
  ('USG', null, 'both', 1.035, 1.060, ARRAY['urine specific gravity','specific gravity'], 'urinalysis'),
  ('Urine pH', null, 'both', 6.0, 7.5, ARRAY['urine ph'], 'urinalysis'),
  ('Urine protein', null, 'both', null, null, ARRAY['proteinuria','ua protein'], 'urinalysis'),
  ('Urine glucose', null, 'both', null, null, ARRAY['ua glucose','glucosuria'], 'urinalysis'),
  ('Urine ketones', null, 'both', null, null, ARRAY['ketones','ua ketones'], 'urinalysis'),
  ('Urine blood', null, 'both', null, null, ARRAY['hematuria','ua blood'], 'urinalysis'),
  ('Urine WBC', '/hpf', 'both', null, null, ARRAY['ua wbc'], 'urinalysis'),
  ('Urine RBC', '/hpf', 'both', null, null, ARRAY['ua rbc'], 'urinalysis'),
  ('Urine crystals', null, 'both', null, null, ARRAY['crystals','crystalluria'], 'urinalysis'),
  ('Urine bacteria', null, 'both', null, null, ARRAY['bacteriuria','ua bacteria'], 'urinalysis')
ON CONFLICT (name) DO NOTHING;

UPDATE lab_analytes SET panel_group = 'hematology' WHERE panel_group IS NULL AND name IN ('WBC','RBC','HCT','HGB','MCV','MCHC','PLT','PCV','Total Solids');
UPDATE lab_analytes SET panel_group = 'chemistry' WHERE panel_group IS NULL AND name IN ('GLU','BUN','CREA','SDMA','PHOS','CA','TP','ALB','ALT','ALP','TBIL','Na','K','Cl','CK','Triglycerides');
UPDATE lab_analytes SET panel_group = 'endocrinology' WHERE panel_group IS NULL AND name IN ('T4','Spec fPL');
UPDATE lab_analytes SET panel_group = 'urinalysis' WHERE panel_group IS NULL AND name ILIKE 'urine%';
