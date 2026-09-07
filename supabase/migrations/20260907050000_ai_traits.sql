ALTER TABLE pets ADD COLUMN IF NOT EXISTS ai_traits jsonb;
CREATE TABLE IF NOT EXISTS ai_health_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  findings jsonb,
  summary text,
  disclaimer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_health_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aha_owner ON ai_health_analyses;
CREATE POLICY aha_owner ON ai_health_analyses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pet_relationships pr WHERE pr.pet_id = ai_health_analyses.pet_id AND pr.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pet_relationships pr WHERE pr.pet_id = ai_health_analyses.pet_id AND pr.user_id = auth.uid()));
