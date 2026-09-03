/*
# Create reports table for lost/stray/incident reports with map locations

1. New Tables
- `reports`
  - `id` (uuid, primary key)
  - `report_type` (text: lost, stray, foster, support, inform, emergency)
  - `urgency` (text: low, medium, high, emergency)
  - `incident_category` (text: animal_injury, lost_pet, stray_animal, abuse_neglect, traffic_accident, emergency, other)
  - `pet_name` (text, nullable)
  - `pet_type` (text: dog, cat, other)
  - `breed` (text, nullable)
  - `description` (text)
  - `location_address` (text)
  - `latitude` (double precision)
  - `longitude` (double precision)
  - `contact_name` (text)
  - `contact_phone` (text, nullable)
  - `contact_email` (text, nullable)
  - `photo_urls` (text array, default empty)
  - `status` (text: active, resolved, closed, default 'active')
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `reports`.
- Allow anon + authenticated CRUD since this is a community-shared map (no sign-in required).
- All reports are visible to everyone so nearby users can see lost/found pets and incidents.

3. Indexes
- Index on `latitude, longitude` for proximity queries.
- Index on `status` for filtering active reports.
- Index on `report_type` for filtering by type.
*/

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL DEFAULT 'lost',
  urgency text NOT NULL DEFAULT 'medium',
  incident_category text,
  pet_name text,
  pet_type text DEFAULT 'dog',
  breed text,
  description text NOT NULL,
  location_address text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  contact_name text NOT NULL,
  contact_phone text,
  contact_email text,
  photo_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports"
ON reports FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports"
ON reports FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_reports" ON reports;
CREATE POLICY "anon_update_reports"
ON reports FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_reports" ON reports;
CREATE POLICY "anon_delete_reports"
ON reports FOR DELETE
TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_reports_coordinates ON reports (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports (report_type);
