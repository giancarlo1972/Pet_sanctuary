-- Drop the old/broken nearby_reports function that uses lat/lng columns and p_km param
-- Keep the SECURITY DEFINER version that uses latitude/longitude and p_radius_km
DROP FUNCTION IF EXISTS nearby_reports(double precision, double precision, double precision);