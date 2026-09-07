CREATE TABLE IF NOT EXISTS vaccine_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species text NOT NULL DEFAULT 'both',
  name text NOT NULL,
  manufacturer text,
  duration_years numeric,
  route text,
  aliases text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS vaccine_products_species_name ON vaccine_products (species, lower(name));

CREATE TABLE IF NOT EXISTS lab_analytes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  unit text,
  species text NOT NULL DEFAULT 'both',
  ref_low numeric,
  ref_high numeric,
  aliases text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS condition_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text,
  aliases text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  common_dose text,
  aliases text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_custom_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vaccine_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_analytes ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_custom_pending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_read_vax ON vaccine_products;
CREATE POLICY catalog_read_vax ON vaccine_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_read_lab ON lab_analytes;
CREATE POLICY catalog_read_lab ON lab_analytes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_read_cond ON condition_catalog;
CREATE POLICY catalog_read_cond ON condition_catalog FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_read_med ON medications;
CREATE POLICY catalog_read_med ON medications FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS catalog_custom_ins ON catalog_custom_pending;
CREATE POLICY catalog_custom_ins ON catalog_custom_pending FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS catalog_custom_sel ON catalog_custom_pending;
CREATE POLICY catalog_custom_sel ON catalog_custom_pending FOR SELECT TO authenticated USING (true);

INSERT INTO vaccine_products (species, name, manufacturer, duration_years, route, aliases) VALUES
  ('feline', 'Purevax Rabies Feline 1 year', 'Boehringer Ingelheim', 1, 'SC', ARRAY['purevax rabies','rabies 1yr','rabies feline']),
  ('feline', 'Purevax Rabies Feline 3 year', 'Boehringer Ingelheim', 3, 'SC', ARRAY['purevax rabies 3 year','purevax rabies feline 3 year','rabies 3yr']),
  ('feline', 'FVRCP 1 year', 'Various', 1, 'SC', ARRAY['fvrcp','fvrccp','feline distemper']),
  ('feline', 'FVRCP 3 year', 'Various', 3, 'SC', ARRAY['fvrcp 3-year','fvrcp 3 year']),
  ('feline', 'FeLV', 'Various', 1, 'SC', ARRAY['feline leukemia','leukemia']),
  ('canine', 'DHPP 1 year', 'Various', 1, 'SC', ARRAY['dhpp','distemper','da2pp']),
  ('canine', 'DHPP 3 year', 'Various', 3, 'SC', ARRAY['dhpp 3 year']),
  ('canine', 'Rabies 1 year', 'Various', 1, 'SC', ARRAY['rabies','rabies 1yr']),
  ('canine', 'Rabies 3 year', 'Various', 3, 'SC', ARRAY['rabies 3 year','rabies 3yr']),
  ('canine', 'Bordetella', 'Various', 1, 'IN', ARRAY['kennel cough','bordetella bronchiseptica']),
  ('canine', 'Leptospirosis', 'Various', 1, 'SC', ARRAY['lepto','leptospira']),
  ('canine', 'Lyme', 'Various', 1, 'SC', ARRAY['borrelia']),
  ('canine', 'Canine Influenza', 'Various', 1, 'SC', ARRAY['civ','flu'])
ON CONFLICT DO NOTHING;

INSERT INTO lab_analytes (name, unit, species, ref_low, ref_high, aliases) VALUES
  ('WBC', 'K/µL', 'both', 5.5, 19.5, ARRAY['white blood cells','wbc count']),
  ('RBC', 'M/µL', 'both', 6.5, 12.2, ARRAY['red blood cells']),
  ('HCT', '%', 'both', 30, 45, ARRAY['hematocrit','pcv']),
  ('HGB', 'g/dL', 'both', 9.8, 15.5, ARRAY['hemoglobin']),
  ('MCV', 'fL', 'both', 39, 56, ARRAY[]::text[]),
  ('MCHC', 'g/dL', 'both', 30, 36, ARRAY['mean corpuscular hemoglobin concentration']),
  ('PLT', 'K/µL', 'both', 175, 500, ARRAY['platelets','platelet']),
  ('GLU', 'mg/dL', 'both', 74, 159, ARRAY['glucose','blood glucose']),
  ('BUN', 'mg/dL', 'both', 16, 36, ARRAY['urea nitrogen','urea']),
  ('CREA', 'mg/dL', 'both', 0.8, 2.4, ARRAY['creatinine']),
  ('SDMA', 'µg/dL', 'both', 0, 14, ARRAY['idexx sdma','symmetric dimethylarginine']),
  ('PHOS', 'mg/dL', 'both', 2.5, 6.1, ARRAY['phosphorus','phosphate']),
  ('CA', 'mg/dL', 'both', 7.8, 11.3, ARRAY['calcium']),
  ('TP', 'g/dL', 'both', 5.7, 8.9, ARRAY['total protein']),
  ('ALB', 'g/dL', 'both', 2.3, 3.9, ARRAY['albumin']),
  ('ALT', 'U/L', 'both', 12, 130, ARRAY['sgpt','alanine aminotransferase']),
  ('ALP', 'U/L', 'both', 14, 111, ARRAY['alkp','alkaline phosphatase']),
  ('TBIL', 'mg/dL', 'both', 0, 0.9, ARRAY['bilirubin','total bilirubin']),
  ('Na', 'mmol/L', 'both', 150, 165, ARRAY['sodium']),
  ('K', 'mmol/L', 'both', 3.5, 5.8, ARRAY['potassium']),
  ('Cl', 'mmol/L', 'both', 112, 129, ARRAY['chloride']),
  ('T4', 'µg/dL', 'feline', 0.8, 4.7, ARRAY['thyroxine','total t4']),
  ('FeLV', null, 'feline', null, null, ARRAY['feline leukemia antigen']),
  ('FIV', null, 'feline', null, null, ARRAY['feline immunodeficiency'])
ON CONFLICT (name) DO NOTHING;

INSERT INTO condition_catalog (name, category, aliases) VALUES
  ('Obesity', 'metabolic', ARRAY['obese','bcs 8','bcs 9','overweight','obese bcs 8']),
  ('Underweight', 'metabolic', ARRAY['bcs 3','thin']),
  ('Dental disease', 'dental', ARRAY['periodontal','tartar']),
  ('Upper respiratory infection', 'infectious', ARRAY['uri','cat flu']),
  ('Chronic kidney disease', 'renal', ARRAY['ckd','crf','renal disease']),
  ('Hyperthyroidism', 'endocrine', ARRAY['hyperthyroid']),
  ('Diabetes mellitus', 'endocrine', ARRAY['diabetes','dm']),
  ('Osteoarthritis', 'musculoskeletal', ARRAY['arthritis','not jumping normally','lameness']),
  ('Allergic dermatitis', 'dermatology', ARRAY['allergies','atopy','itching']),
  ('Heart murmur', 'cardiac', ARRAY['murmur']),
  ('ADR', 'general', ARRAY['ain''t doing right','lethargy']),
  ('Intestinal parasites', 'infectious', ARRAY['worms','deworming'])
ON CONFLICT (name) DO NOTHING;

INSERT INTO medications (name, common_dose, aliases) VALUES
  ('Strongid T', 'pyrantel as labeled', ARRAY['strongid','pyrantel','dewormer']),
  ('Revolution Plus', 'topical as labeled', ARRAY['revolution','selamectin']),
  ('Bravecto', 'as labeled', ARRAY['fluralaner']),
  ('Prednisolone', '1–2 mg/kg', ARRAY['pred','prednisone']),
  ('Onsior', 'as labeled', ARRAY['robenacoxib']),
  ('Cerenia', 'as labeled', ARRAY['maropitant']),
  ('Convenia', '8 mg/kg SQ', ARRAY['cefovecin'])
ON CONFLICT (name) DO NOTHING;
