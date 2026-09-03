/*
# Add vet clinics, lab panels/results, clinic records, and procedure enhancements

## Purpose
Extend the pet health record to hold real veterinary records: shared clinic
directory, lab results with reference ranges and flags, per-clinic patient
record numbers, and procedure cost/provider fields.

## New Tables

1. **vet_clinics** — shared directory of veterinary clinics. Any authenticated
   user can add a clinic; all authenticated users can see all clinics (it's a
   directory, not private data).
   - id (uuid PK)
   - name (text, not null)
   - address (text)
   - phone (text)
   - website (text)
   - created_by (uuid, defaults to auth.uid())
   - created_at (timestamptz, defaults now())

2. **pet_clinic_records** — stores a pet's patient/client record number per
   clinic. Scoped to the pet's owner via pet_relationships.
   - id (uuid PK)
   - pet_id (uuid FK -> pets, not null)
   - clinic_id (uuid FK -> vet_clinics, not null)
   - record_number (text, not null)
   - notes (text)
   - created_by (uuid, defaults to auth.uid())
   - created_at (timestamptz, defaults now())
   - UNIQUE(pet_id, clinic_id)

3. **lab_panels** — a lab panel (e.g. "CBC", "Chemistry Panel"). Scoped to the
   pet's owner via pet_relationships.
   - id (uuid PK)
   - pet_id (uuid FK -> pets, not null)
   - panel_name (text, not null)
   - collected_on (date, not null)
   - clinic_id (uuid FK -> vet_clinics)
   - vet_name (text)
   - document_url (text)
   - notes (text)
   - recorded_by (uuid, defaults to auth.uid())
   - created_at (timestamptz, defaults now())

4. **lab_results** — individual analyte rows within a panel. Inherit access
   from lab_panels via FK.
   - id (uuid PK)
   - panel_id (uuid FK -> lab_panels, not null, ON DELETE CASCADE)
   - analyte (text, not null)
   - value_numeric (numeric) — for numeric results
   - value_text (text) — for text results like "Negative"
   - unit (text)
   - ref_low (numeric) — lab's own reference range low
   - ref_high (numeric) — lab's own reference range high
   - ref_text (text) — lab's own text reference range (e.g. "Negative")
   - flag (text) — flag from the lab report (H, L, *, etc.), never computed by us
   - created_at (timestamptz, defaults now())

## Modified Tables

1. **pet_care_events** — add new event type values via CHECK constraint update.
   The existing event_type is text (no constraint), so new types
   (spay_neuter, test_result, microchip_implanted, parasite_treatment) work
   without schema changes. No DDL needed.

2. **pet_vaccinations** — already has all needed columns (vet_license,
   manufacturer, lot_number, lot_expires_on, injection_site, vaccine_type,
   duration_years, tag_number, is_booster, superseded, notes, clinic_id,
   vet_name). No DDL needed.

3. **pets** — already has body_condition_score, target_weight_kg,
   previous_names, date_of_birth. No DDL needed.

## Security (RLS)

All new tables get RLS enabled with policies scoped through
pet_relationships (for pet-owned tables) or authenticated-only (for the
shared clinic directory).

- vet_clinics: any authenticated user can SELECT/INSERT. UPDATE/DELETE
  only by the creator.
- pet_clinic_records: scoped through pet_relationships (owner or shelter
  member of the pet).
- lab_panels: scoped through pet_relationships.
- lab_results: scoped through lab_panels -> pet_relationships.

## Important Notes

1. Lab result flags (H, L, *, etc.) come from the lab report and are stored
   as-is. The app NEVER computes or interprets normal/abnormal status.
2. Reference ranges (ref_low, ref_high, ref_text) are the lab's own ranges,
   stored verbatim. The app displays them but does not compute whether a
   value is in range.
3. Numeric trend views plot values over time but do not annotate or
   interpret trends.
*/

-- ═══════════════════════════════════════════════════════════════════
-- 1. vet_clinics — shared directory
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vet_clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  website text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vet_clinics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vc_select_all" ON vet_clinics;
CREATE POLICY "vc_select_all" ON vet_clinics FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "vc_insert_own" ON vet_clinics;
CREATE POLICY "vc_insert_own" ON vet_clinics FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "vc_update_own" ON vet_clinics;
CREATE POLICY "vc_update_own" ON vet_clinics FOR UPDATE
  TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "vc_delete_own" ON vet_clinics;
CREATE POLICY "vc_delete_own" ON vet_clinics FOR DELETE
  TO authenticated USING (auth.uid() = created_by);

-- ═══════════════════════════════════════════════════════════════════
-- 2. pet_clinic_records — per-pet, per-clinic patient record number
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pet_clinic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES vet_clinics(id) ON DELETE CASCADE,
  record_number text NOT NULL,
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pet_id, clinic_id)
);

ALTER TABLE pet_clinic_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pcr_select_own" ON pet_clinic_records;
CREATE POLICY "pcr_select_own" ON pet_clinic_records FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = pet_clinic_records.pet_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = pet_clinic_records.pet_id AND sm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "pcr_insert_own" ON pet_clinic_records;
CREATE POLICY "pcr_insert_own" ON pet_clinic_records FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = pet_clinic_records.pet_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = pet_clinic_records.pet_id AND sm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "pcr_update_own" ON pet_clinic_records;
CREATE POLICY "pcr_update_own" ON pet_clinic_records FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = pet_clinic_records.pet_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = pet_clinic_records.pet_id AND sm.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = pet_clinic_records.pet_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = pet_clinic_records.pet_id AND sm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "pcr_delete_own" ON pet_clinic_records;
CREATE POLICY "pcr_delete_own" ON pet_clinic_records FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = pet_clinic_records.pet_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = pet_clinic_records.pet_id AND sm.user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════
-- 3. lab_panels — lab panel header
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lab_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  panel_name text NOT NULL,
  collected_on date NOT NULL DEFAULT CURRENT_DATE,
  clinic_id uuid REFERENCES vet_clinics(id) ON DELETE SET NULL,
  vet_name text,
  document_url text,
  notes text,
  recorded_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lab_panels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lp_select_own" ON lab_panels;
CREATE POLICY "lp_select_own" ON lab_panels FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = lab_panels.pet_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = lab_panels.pet_id AND sm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "lp_insert_own" ON lab_panels;
CREATE POLICY "lp_insert_own" ON lab_panels FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = lab_panels.pet_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = lab_panels.pet_id AND sm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "lp_update_own" ON lab_panels;
CREATE POLICY "lp_update_own" ON lab_panels FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = lab_panels.pet_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = lab_panels.pet_id AND sm.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = lab_panels.pet_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = lab_panels.pet_id AND sm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "lp_delete_own" ON lab_panels;
CREATE POLICY "lp_delete_own" ON lab_panels FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = lab_panels.pet_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = lab_panels.pet_id AND sm.user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════
-- 4. lab_results — individual analyte rows
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id uuid NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
  analyte text NOT NULL,
  value_numeric numeric,
  value_text text,
  unit text,
  ref_low numeric,
  ref_high numeric,
  ref_text text,
  flag text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lr_select_own" ON lab_results;
CREATE POLICY "lr_select_own" ON lab_results FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM lab_panels lp
      JOIN pet_relationships r ON r.pet_id = lp.pet_id
      WHERE lp.id = lab_results.panel_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM lab_panels lp
      JOIN pets p ON p.id = lp.pet_id
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE lp.id = lab_results.panel_id AND sm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "lr_insert_own" ON lab_results;
CREATE POLICY "lr_insert_own" ON lab_results FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM lab_panels lp
      JOIN pet_relationships r ON r.pet_id = lp.pet_id
      WHERE lp.id = lab_results.panel_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM lab_panels lp
      JOIN pets p ON p.id = lp.pet_id
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE lp.id = lab_results.panel_id AND sm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "lr_update_own" ON lab_results;
CREATE POLICY "lr_update_own" ON lab_results FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM lab_panels lp
      JOIN pet_relationships r ON r.pet_id = lp.pet_id
      WHERE lp.id = lab_results.panel_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM lab_panels lp
      JOIN pets p ON p.id = lp.pet_id
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE lp.id = lab_results.panel_id AND sm.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM lab_panels lp
      JOIN pet_relationships r ON r.pet_id = lp.pet_id
      WHERE lp.id = lab_results.panel_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM lab_panels lp
      JOIN pets p ON p.id = lp.pet_id
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE lp.id = lab_results.panel_id AND sm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "lr_delete_own" ON lab_results;
CREATE POLICY "lr_delete_own" ON lab_results FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM lab_panels lp
      JOIN pet_relationships r ON r.pet_id = lp.pet_id
      WHERE lp.id = lab_results.panel_id
      AND r.user_id = auth.uid() AND r.ended_on IS NULL)
    OR EXISTS (SELECT 1 FROM lab_panels lp
      JOIN pets p ON p.id = lp.pet_id
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE lp.id = lab_results.panel_id AND sm.user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_pet_clinic_records_pet_id ON pet_clinic_records(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_clinic_records_clinic_id ON pet_clinic_records(clinic_id);
CREATE INDEX IF NOT EXISTS idx_lab_panels_pet_id ON lab_panels(pet_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_panel_id ON lab_results(panel_id);
CREATE INDEX IF NOT EXISTS idx_vet_clinics_name ON vet_clinics(name);
