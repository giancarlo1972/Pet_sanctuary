-- Pet record v2 — medical tables + can_read_pet_medical RLS. Idempotent.

CREATE OR REPLACE FUNCTION public.can_read_pet_medical(pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pets p WHERE p.id = pid AND (
      p.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM pet_relationships pr WHERE pr.pet_id = p.id AND pr.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = p.shelter_id AND om.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM record_access_requests rar
        WHERE rar.pet_id = p.id AND rar.requester_id = auth.uid()
          AND rar.scope = 'medical' AND rar.status = 'approved'
      )
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_pet_medical(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_pet_medical(uuid) TO authenticated;

ALTER TABLE IF EXISTS pet_vaccinations ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE IF EXISTS pet_vaccinations ADD COLUMN IF NOT EXISTS dose text;
ALTER TABLE IF EXISTS pet_vaccinations ADD COLUMN IF NOT EXISTS lot text;
ALTER TABLE IF EXISTS pet_vaccinations ADD COLUMN IF NOT EXISTS site text;
ALTER TABLE IF EXISTS pet_vaccinations ADD COLUMN IF NOT EXISTS reactions text;
ALTER TABLE IF EXISTS pet_vaccinations ADD COLUMN IF NOT EXISTS confirmed boolean DEFAULT true;
ALTER TABLE IF EXISTS pet_vaccinations ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  name text,
  value text,
  unit text,
  flag text,
  collected_on date,
  clinic text,
  confirmed boolean DEFAULT true,
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pet_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  kind text,
  storage_path text,
  extracted jsonb,
  confirmed boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  weight_lb numeric NOT NULL,
  measured_on date NOT NULL DEFAULT CURRENT_DATE,
  source text DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pet_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  vendor text,
  name text,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES pet_devices(id) ON DELETE CASCADE,
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  kind text,
  value numeric,
  unit text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb
);

CREATE TABLE IF NOT EXISTS ai_health_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid REFERENCES pets(id) ON DELETE CASCADE,
  findings jsonb,
  summary text,
  disclaimer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['lab_results','pet_documents','weight_entries','pet_devices','device_readings','ai_health_analyses']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_medical ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_medical ON %I FOR ALL TO authenticated USING (can_read_pet_medical(pet_id)) WITH CHECK (can_read_pet_medical(pet_id))',
      t, t
    );
  END LOOP;
END $$;
