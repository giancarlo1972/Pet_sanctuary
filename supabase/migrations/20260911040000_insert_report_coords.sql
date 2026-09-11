-- insert_report: never fail NOT NULL on latitude/longitude when the client
-- omitted them (map geocode miss). Coalesce to 0; UI still sends real coords
-- when the pin is set. Paste once. Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.insert_report(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid := gen_random_uuid();
  rec public.reports;
  sev text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'payload required';
  END IF;

  sev := lower(coalesce(p->>'severity', 'standard'));
  IF sev NOT IN ('standard', 'urgent', 'critical') THEN
    RAISE EXCEPTION 'invalid severity';
  END IF;

  rec := jsonb_populate_record(NULL::public.reports, p);
  rec.id := new_id;
  rec.status := 'pending_moderation';
  rec.severity := sev;
  rec.user_id := auth.uid();
  rec.created_at := coalesce(rec.created_at, now());
  rec.latitude := coalesce(rec.latitude, 0);
  rec.longitude := coalesce(rec.longitude, 0);

  IF rec.description IS NULL OR length(trim(rec.description)) = 0 THEN
    RAISE EXCEPTION 'description required';
  END IF;
  IF rec.location_address IS NULL OR length(trim(rec.location_address)) = 0 THEN
    RAISE EXCEPTION 'location required';
  END IF;
  IF rec.report_type IS NULL OR length(trim(rec.report_type)) = 0 THEN
    RAISE EXCEPTION 'report_type required';
  END IF;

  INSERT INTO public.reports SELECT rec.*;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_report(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_report(jsonb) TO anon, authenticated;
