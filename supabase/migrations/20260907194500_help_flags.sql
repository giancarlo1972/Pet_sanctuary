-- I can help: volunteer / responder flags + radius. Run in SQL Editor.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS volunteer_active boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS responder_active boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alert_radius_mi integer NOT NULL DEFAULT 5;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_alert_radius_mi_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_alert_radius_mi_check
  CHECK (alert_radius_mi BETWEEN 1 AND 50);

CREATE OR REPLACE FUNCTION public.responder_is_verified(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_verifications uv
    WHERE uv.user_id = uid
      AND uv.id_status IN ('verified', 'approved')
      AND uv.phone_verified = true
      AND uv.responder_training = 'passed'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.responder_is_verified(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.responder_is_verified(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_unverified_responder()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.responder_active IS TRUE AND NOT public.responder_is_verified(NEW.id) THEN
    RAISE EXCEPTION 'responder_active requires verified ID, phone, and passed responder training';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unverified_responder ON profiles;
CREATE TRIGGER trg_prevent_unverified_responder
  BEFORE INSERT OR UPDATE OF responder_active ON profiles
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_unverified_responder();

-- Nearby help alerts use the caller's flags + radius (miles → km)
CREATE OR REPLACE FUNCTION public.nearby_help_alerts(
  p_lat double precision,
  p_lng double precision
)
RETURNS TABLE (
  id uuid,
  report_type text,
  severity text,
  pet_name text,
  location_address text,
  description text,
  created_at timestamptz,
  distance_km double precision
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rad_km double precision := 8.05;
  vol boolean := false;
  resp boolean := false;
BEGIN
  SELECT coalesce(alert_radius_mi, 5) * 1.60934,
         coalesce(volunteer_active, false),
         coalesce(responder_active, false)
    INTO rad_km, vol, resp
    FROM profiles WHERE id = auth.uid();

  RETURN QUERY
  SELECT r.id, r.report_type, r.severity, r.pet_name, r.location_address, r.description, r.created_at,
    (6371 * acos(least(1.0,
      cos(radians(p_lat)) * cos(radians(r.latitude)) *
      cos(radians(r.longitude) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(r.latitude))
    ))) AS distance_km
  FROM reports r
  WHERE r.status IN ('active', 'open')
    AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL
    AND (6371 * acos(least(1.0,
      cos(radians(p_lat)) * cos(radians(r.latitude)) *
      cos(radians(r.longitude) - radians(p_lng)) +
      sin(radians(p_lat)) * sin(radians(r.latitude))
    ))) <= rad_km
    AND (
      (vol AND r.report_type IN ('lost','stray','foster','support','inform'))
      OR (resp AND r.report_type IN ('emergency','injured','road_accident','cruelty'))
      OR (NOT vol AND NOT resp)
    )
  ORDER BY distance_km ASC
  LIMIT 50;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.nearby_help_alerts(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_help_alerts(double precision, double precision) TO authenticated;

CREATE OR REPLACE FUNCTION public.help_alerts_week_count(kind text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0;
BEGIN
  SELECT count(*)::int INTO n
  FROM reports r
  WHERE r.created_at > now() - interval '7 days'
    AND r.status IN ('active','open')
    AND (
      (kind = 'volunteer' AND r.report_type IN ('lost','stray','foster','support','inform'))
      OR (kind = 'responder' AND r.report_type IN ('emergency','injured','road_accident','cruelty'))
    );
  RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.help_alerts_week_count(text) TO authenticated;
