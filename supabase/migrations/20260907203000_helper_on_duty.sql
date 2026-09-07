-- ON DUTY helpers. Geohash precision 5 only — never store lat/lng.
-- Idempotent: add columns if an older help_requests stub already exists.

ALTER TABLE user_verifications ADD COLUMN IF NOT EXISTS phone text;

CREATE TABLE IF NOT EXISTS helper_status (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  on_duty boolean NOT NULL DEFAULT false,
  services text[] NOT NULL DEFAULT '{}',
  radius_mi integer NOT NULL DEFAULT 5 CHECK (radius_mi BETWEEN 1 AND 50),
  contact_prefs text[] NOT NULL DEFAULT ARRAY['inapp']::text[],
  geohash text,
  until_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE helper_status ADD COLUMN IF NOT EXISTS on_duty boolean NOT NULL DEFAULT false;
ALTER TABLE helper_status ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}';
ALTER TABLE helper_status ADD COLUMN IF NOT EXISTS radius_mi integer NOT NULL DEFAULT 5;
ALTER TABLE helper_status ADD COLUMN IF NOT EXISTS contact_prefs text[] NOT NULL DEFAULT ARRAY['inapp']::text[];
ALTER TABLE helper_status ADD COLUMN IF NOT EXISTS geohash text;
ALTER TABLE helper_status ADD COLUMN IF NOT EXISTS until_at timestamptz;
ALTER TABLE helper_status ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  helper_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  service text,
  status text NOT NULL DEFAULT 'pending',
  requester_geohash text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS requester_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS helper_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS service text;
ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS requester_geohash text;
ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE help_requests ADD COLUMN IF NOT EXISTS decided_at timestamptz;

DO $$ BEGIN
  ALTER TABLE help_requests DROP CONSTRAINT IF EXISTS help_requests_status_check;
  ALTER TABLE help_requests ADD CONSTRAINT help_requests_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'done'));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS help_requests_helper_idx ON help_requests (helper_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS helper_status_duty_idx ON helper_status (on_duty, until_at) WHERE on_duty;

CREATE OR REPLACE FUNCTION public.helper_status_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.geohash IS NOT NULL THEN NEW.geohash := left(NEW.geohash, 5); END IF;
  IF NEW.on_duty THEN
    IF NEW.services IS NULL OR cardinality(NEW.services) < 1 THEN
      RAISE EXCEPTION 'on_duty requires at least one service';
    END IF;
    IF NEW.until_at IS NULL OR NEW.until_at < now() THEN
      NEW.until_at := now() + interval '8 hours';
    END IF;
    IF NEW.contact_prefs && ARRAY['text','call']::text[] THEN
      IF NOT EXISTS (
        SELECT 1 FROM user_verifications uv
        WHERE uv.user_id = NEW.user_id AND uv.phone_verified = true
      ) THEN
        RAISE EXCEPTION 'text/call require a verified phone';
      END IF;
    END IF;
  ELSE
    NEW.until_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_helper_status_guard ON helper_status;
CREATE TRIGGER trg_helper_status_guard
  BEFORE INSERT OR UPDATE ON helper_status
  FOR EACH ROW EXECUTE PROCEDURE public.helper_status_guard();

ALTER TABLE helper_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS helper_status_own ON helper_status;
CREATE POLICY helper_status_own ON helper_status FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS helper_status_read_duty ON helper_status;
CREATE POLICY helper_status_read_duty ON helper_status FOR SELECT TO authenticated
  USING (on_duty AND (until_at IS NULL OR until_at > now()));

DROP POLICY IF EXISTS help_requests_select ON help_requests;
DROP POLICY IF EXISTS help_requests_insert ON help_requests;
DROP POLICY IF EXISTS help_requests_update ON help_requests;
CREATE POLICY help_requests_select ON help_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR helper_id = auth.uid());
CREATE POLICY help_requests_insert ON help_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND helper_id <> auth.uid());
CREATE POLICY help_requests_update ON help_requests FOR UPDATE TO authenticated
  USING (helper_id = auth.uid() OR requester_id = auth.uid())
  WITH CHECK (helper_id = auth.uid() OR requester_id = auth.uid());

CREATE OR REPLACE FUNCTION public.helpers_on_duty_near(p_hashes text[])
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text,
  services text[],
  radius_mi integer,
  geohash text,
  until_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT hs.user_id, p.full_name, p.avatar_url, hs.services, hs.radius_mi, hs.geohash, hs.until_at
  FROM helper_status hs
  JOIN profiles p ON p.id = hs.user_id
  WHERE hs.on_duty
    AND (hs.until_at IS NULL OR hs.until_at > now())
    AND hs.geohash = ANY (p_hashes)
    AND hs.user_id <> auth.uid()
    AND coalesce(p.blocked, false) = false
    AND auth.uid() IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.helpers_on_duty_near(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.help_request_call_number(p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE rec help_requests; num text;
BEGIN
  SELECT * INTO rec FROM help_requests WHERE id = p_id;
  IF rec.id IS NULL OR rec.status <> 'accepted' THEN RETURN NULL; END IF;
  IF auth.uid() = rec.requester_id THEN
    SELECT uv.phone INTO num FROM user_verifications uv WHERE uv.user_id = rec.helper_id;
  ELSIF auth.uid() = rec.helper_id THEN
    SELECT uv.phone INTO num FROM user_verifications uv WHERE uv.user_id = rec.requester_id;
  ELSE
    RETURN NULL;
  END IF;
  RETURN num;
END;
$$;
GRANT EXECUTE ON FUNCTION public.help_request_call_number(uuid) TO authenticated;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE help_requests;
EXCEPTION WHEN others THEN NULL;
END $$;
