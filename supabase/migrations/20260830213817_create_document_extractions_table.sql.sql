/*
# Create document_extractions table for AI vet record import

1. New Tables
- `document_extractions`
  - `id` (uuid, primary key)
  - `document_id` (uuid, FK to pet_documents, not null)
  - `pet_id` (uuid, FK to pets, not null)
  - `status` (text, not null, default 'pending_review' — values: pending_review, applied, dismissed)
  - `extracted_data` (jsonb, nullable — the structured JSON returned by the AI)
  - `error_message` (text, nullable — populated if extraction fails)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  - `applied_by` (uuid, nullable — auth.users ref)
  - `applied_at` (timestamptz, nullable)

2. Security
- Enable RLS on document_extractions.
- Owner-scoped CRUD: authenticated users can only access extractions for pets
  they own, foster, or manage (via pet_relationships or shelter_members).
- CHECK constraint on status to enforce valid values.

3. Notes
- This table stores AI-extracted veterinary data pending user review.
- No medical data is written to clinical tables until the user confirms
  and the status is set to 'applied'.
*/

CREATE TABLE IF NOT EXISTS document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES pet_documents(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending_review',
  extracted_data jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  applied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at timestamptz
);

ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;

-- CHECK constraint on status
ALTER TABLE document_extractions
  DROP CONSTRAINT IF EXISTS document_extractions_status_check;
ALTER TABLE document_extractions
  ADD CONSTRAINT document_extractions_status_check
  CHECK (status IN ('pending_review', 'applied', 'dismissed'));

-- Index for common lookups
CREATE INDEX IF NOT EXISTS idx_document_extractions_document_id
  ON document_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_extractions_pet_id
  ON document_extractions(pet_id);

-- RLS policies: same ownership pattern as other pet tables
DROP POLICY IF EXISTS "de_select_own" ON document_extractions;
CREATE POLICY "de_select_own" ON document_extractions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = document_extractions.pet_id
        AND r.user_id = auth.uid()
        AND r.ended_on IS NULL
    ) OR EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = document_extractions.pet_id
        AND sm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "de_insert_own" ON document_extractions;
CREATE POLICY "de_insert_own" ON document_extractions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = document_extractions.pet_id
        AND r.user_id = auth.uid()
        AND r.ended_on IS NULL
    ) OR EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = document_extractions.pet_id
        AND sm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "de_update_own" ON document_extractions;
CREATE POLICY "de_update_own" ON document_extractions FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = document_extractions.pet_id
        AND r.user_id = auth.uid()
        AND r.ended_on IS NULL
    ) OR EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = document_extractions.pet_id
        AND sm.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = document_extractions.pet_id
        AND r.user_id = auth.uid()
        AND r.ended_on IS NULL
    ) OR EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = document_extractions.pet_id
        AND sm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "de_delete_own" ON document_extractions;
CREATE POLICY "de_delete_own" ON document_extractions FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = document_extractions.pet_id
        AND r.user_id = auth.uid()
        AND r.ended_on IS NULL
    ) OR EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
      WHERE p.id = document_extractions.pet_id
        AND sm.user_id = auth.uid()
    )
  );