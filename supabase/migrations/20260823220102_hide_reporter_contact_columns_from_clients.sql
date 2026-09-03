/*
  # Keep reporter contact details private

  1. Security
    - Revoke the table-wide SELECT privilege on `public.reports` from the
      `anon` and `authenticated` roles.
    - Re-grant SELECT on every column EXCEPT `contact_name`, `contact_phone`
      and `contact_email`, so the public map keeps working while the
      reporter's personal contact details are no longer served.

  2. Notes
    - The only read in the application (app/reports-map.tsx) selects
      id, report_type, urgency, pet_name, description, location_address,
      latitude, longitude, status and created_at, all of which remain granted.
    - INSERT still covers all columns, so a reporter can still submit their
      contact details; they simply cannot be read back by the public API.
*/

REVOKE SELECT ON public.reports FROM anon;
REVOKE SELECT ON public.reports FROM authenticated;

GRANT SELECT (
  id,
  report_type,
  urgency,
  incident_category,
  pet_name,
  pet_type,
  breed,
  description,
  location_address,
  latitude,
  longitude,
  photo_urls,
  status,
  created_at
) ON public.reports TO anon;

GRANT SELECT (
  id,
  report_type,
  urgency,
  incident_category,
  pet_name,
  pet_type,
  breed,
  description,
  location_address,
  latitude,
  longitude,
  photo_urls,
  status,
  created_at
) ON public.reports TO authenticated;
