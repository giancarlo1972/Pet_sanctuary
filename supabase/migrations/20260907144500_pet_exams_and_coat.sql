ALTER TABLE pets ADD COLUMN IF NOT EXISTS coat text;

CREATE TABLE IF NOT EXISTS pet_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  visit_date date,
  clinic text,
  vitals jsonb NOT NULL DEFAULT '{}'::jsonb,
  systems jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pet_exams_pet_date ON pet_exams (pet_id, visit_date DESC);

ALTER TABLE pet_exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pet_exams_select ON pet_exams;
CREATE POLICY pet_exams_select ON pet_exams FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pets p WHERE p.id = pet_exams.pet_id AND p.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM pet_relationships r
      WHERE r.pet_id = pet_exams.pet_id AND r.user_id = auth.uid() AND r.ended_on IS NULL
    )
  );

DROP POLICY IF EXISTS pet_exams_write ON pet_exams;
CREATE POLICY pet_exams_write ON pet_exams FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM pets p WHERE p.id = pet_exams.pet_id AND p.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM pets p WHERE p.id = pet_exams.pet_id AND p.owner_id = auth.uid())
  );
