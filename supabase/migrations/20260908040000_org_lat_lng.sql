-- Store geocoded org pins so Nearby does not re-geocode every visit.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS longitude double precision;

GRANT SELECT (latitude, longitude) ON organizations TO anon, authenticated;

-- Anyone can fill missing coords on an approved org; never overwrite a stored pin.
CREATE OR REPLACE FUNCTION public.store_org_coords(p_id uuid, p_lat double precision, p_lng double precision)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_id IS NULL OR p_lat IS NULL OR p_lng IS NULL THEN RETURN; END IF;
  IF p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN RETURN; END IF;
  UPDATE organizations
     SET latitude = p_lat, longitude = p_lng
   WHERE id = p_id
     AND status = 'approved'
     AND (latitude IS NULL OR longitude IS NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.store_org_coords(uuid, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_org_coords(uuid, double precision, double precision) TO anon, authenticated;
