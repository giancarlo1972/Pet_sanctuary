ALTER TABLE ai_health_analyses ADD COLUMN IF NOT EXISTS run_number int;
ALTER TABLE ai_health_analyses ADD COLUMN IF NOT EXISTS inputs jsonb;
ALTER TABLE ai_health_analyses ADD COLUMN IF NOT EXISTS shared_with_vet_at timestamptz;
ALTER TABLE ai_health_analyses ADD COLUMN IF NOT EXISTS verdict text;
ALTER TABLE ai_health_analyses ADD COLUMN IF NOT EXISTS timeline jsonb;
ALTER TABLE ai_health_analyses ADD COLUMN IF NOT EXISTS trends jsonb;
ALTER TABLE ai_health_analyses ADD COLUMN IF NOT EXISTS conclusion text;

CREATE TABLE IF NOT EXISTS pet_identifiers (
  pet_id uuid PRIMARY KEY REFERENCES pets(id) ON DELETE CASCADE,
  microchip_number text,
  issuer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pet_identifiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pet_identifiers_read ON pet_identifiers;
CREATE POLICY pet_identifiers_read ON pet_identifiers FOR SELECT TO authenticated
  USING (can_read_pet_medical(pet_id));
DROP POLICY IF EXISTS pet_identifiers_write ON pet_identifiers;
CREATE POLICY pet_identifiers_write ON pet_identifiers FOR ALL TO authenticated
  USING (can_read_pet_medical(pet_id))
  WITH CHECK (can_read_pet_medical(pet_id));

CREATE TABLE IF NOT EXISTS identifier_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE identifier_access_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS iar_own ON identifier_access_requests;
CREATE POLICY iar_own ON identifier_access_requests FOR ALL TO authenticated
  USING (user_id = auth.uid() OR can_read_pet_medical(pet_id))
  WITH CHECK (user_id = auth.uid());
