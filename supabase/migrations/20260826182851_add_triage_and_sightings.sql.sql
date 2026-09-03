/*
# Add AI triage columns, report sightings table, and nearby_reports RPC

## What this does
1. Adds AI triage columns to the `reports` table for storing priority, risk tags, and summary from the triage edge function.
2. Creates a `report_sightings` table for community-reported sightings of an alert.
3. Creates a `nearby_reports` RPC that returns active reports within a given radius of a lat/lng point.

## New columns on `reports`
- `ai_priority` (text) — AI-suggested priority: critical, urgent, or standard
- `ai_risk_tags` (text[]) — AI-identified risk tags (e.g. ["hit by car", "trapped"])
- `ai_summary` (text) — AI-generated short summary of the situation

## New table: `report_sightings`
- `id` (uuid, PK)
- `report_id` (uuid, FK to reports, cascade delete)
- `spotter_id` (uuid, FK to auth.users, nullable — null if anonymous)
- `note` (text, nullable) — optional note from the spotter
- `spotted_at` (timestamptz, default now) — when the sighting was reported
- `share_location` (boolean, default false) — whether the spotter shared their location
- `latitude` (double precision, nullable)
- `longitude` (double precision, nullable)

## Security
- RLS enabled on `report_sightings`.
- Anyone (anon + authenticated) can read sightings — they are community-visible on the alert detail screen.
- Any signed-in user can insert sightings.
- No updates or deletes allowed from the client.

## RPC: `nearby_reports(lat, lng, radius_km)`
- Returns active reports within `radius_km` of the given lat/lng.
- Includes distance in km and bearing for display.
- Read-only, callable by anon + authenticated (proximity alerts need to work without sign-in).
*/

-- 1. Add AI triage columns to reports
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'ai_priority'
  ) THEN
    ALTER TABLE reports ADD COLUMN ai_priority text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'ai_risk_tags'
  ) THEN
    ALTER TABLE reports ADD COLUMN ai_risk_tags text[] DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reports' AND column_name = 'ai_summary'
  ) THEN
    ALTER TABLE reports ADD COLUMN ai_summary text;
  END IF;
END $$;

-- 2. Create report_sightings table
CREATE TABLE IF NOT EXISTS report_sightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  spotter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  spotted_at timestamptz NOT NULL DEFAULT now(),
  share_location boolean NOT NULL DEFAULT false,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE report_sightings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_all_sightings" ON report_sightings;
CREATE POLICY "read_all_sightings"
ON report_sightings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_sightings" ON report_sightings;
CREATE POLICY "insert_sightings"
ON report_sightings FOR INSERT
TO authenticated WITH CHECK (true);

-- Index for looking up sightings by report
CREATE INDEX IF NOT EXISTS idx_report_sightings_report_id ON report_sightings(report_id, spotted_at DESC);

-- 3. Create nearby_reports RPC
CREATE OR REPLACE FUNCTION nearby_reports(
  p_lat double precision,
  p_lng double precision,
  p_radius_km integer DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  report_type text,
  severity text,
  pet_name text,
  location_address text,
  description text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz,
  distance_km double precision
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.report_type,
    r.severity,
    r.pet_name,
    r.location_address,
    r.description,
    r.latitude,
    r.longitude,
    r.created_at,
    -- Haversine formula for distance in km
    (
      6371 * acos(
        least(1.0, cos(radians(p_lat)) * cos(radians(r.latitude)) *
        cos(radians(r.longitude) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(r.latitude)))
      )
    ) AS distance_km
  FROM reports r
  WHERE r.status = 'active'
    AND r.latitude IS NOT NULL
    AND r.longitude IS NOT NULL
    AND (
      6371 * acos(
        least(1.0, cos(radians(p_lat)) * cos(radians(r.latitude)) *
        cos(radians(r.longitude) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(r.latitude)))
      )
    ) <= p_radius_km
  ORDER BY distance_km ASC
  LIMIT 10;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION nearby_reports(double precision, double precision, integer) TO anon, authenticated;
