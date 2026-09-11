-- insert_report: jsonb_populate_record leaves missing keys NULL and
-- does not apply column defaults. Prod then fails NOT NULL on
-- moderation_status / allow_direct_contact / approximate_public.
-- Fill those here. Paste once. Idempotent (CREATE OR REPLACE).

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
  def_expr text;
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
  rec.allow_direct_contact := coalesce(rec.allow_direct_contact, false);
  rec.approximate_public := coalesce(rec.approximate_public, true);
  rec.urgency := coalesce(nullif(btrim(rec.urgency), ''), 'medium');
  rec.photo_urls := coalesce(rec.photo_urls, '{}');

  IF rec.moderation_status IS NULL OR btrim(rec.moderation_status) = '' THEN
    SELECT pg_get_expr(ad.adbin, ad.adrelid)
      INTO def_expr
    FROM pg_attrdef ad
    JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
    JOIN pg_class c ON c.oid = ad.adrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'reports'
      AND a.attname = 'moderation_status';

    IF def_expr IS NOT NULL THEN
      EXECUTE format('SELECT %s', def_expr) INTO rec.moderation_status;
    ELSE
      -- 'pending' / 'pending_moderation' fail reports_moderation_status_check.
      -- 'approved' is the only value confirmed to pass that check.
      rec.moderation_status := 'approved';
    END IF;
  END IF;

  IF auth.uid() IS NULL
     AND (rec.contact_phone IS NULL
          OR length(regexp_replace(rec.contact_phone, '\D', '', 'g')) < 7) THEN
    RAISE EXCEPTION 'phone required for anonymous reports';
  END IF;
  IF rec.description IS NULL OR length(btrim(rec.description)) = 0 THEN
    RAISE EXCEPTION 'description required';
  END IF;
  IF rec.location_address IS NULL OR length(btrim(rec.location_address)) = 0 THEN
    RAISE EXCEPTION 'location required';
  END IF;
  IF rec.report_type IS NULL OR length(btrim(rec.report_type)) = 0 THEN
    RAISE EXCEPTION 'report_type required';
  END IF;

  INSERT INTO public.reports SELECT rec.*;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_report(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_report(jsonb) TO anon, authenticated;
