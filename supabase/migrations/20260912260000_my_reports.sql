-- My Reports: owner actions, phone-claim of anon reports, tighter SELECT.
-- Paste once. Idempotent.

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS moderator_note text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolution_outcome text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS last_boosted_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_resolution_outcome_check;
  ALTER TABLE public.reports ADD CONSTRAINT reports_resolution_outcome_check
    CHECK (resolution_outcome IS NULL OR resolution_outcome IN ('found','rescued','no_longer_needed'));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS reports_user_id_idx ON public.reports (user_id, created_at DESC);

-- Public sees live + pending-moderation. Owner (and platform) see own cancelled/rejected/resolved.
DROP POLICY IF EXISTS "anon_select_reports" ON public.reports;
DROP POLICY IF EXISTS reports_select ON public.reports;
CREATE POLICY reports_select ON public.reports FOR SELECT TO anon, authenticated
  USING (
    status IN ('active', 'open', 'pending_moderation', 'pending')
    OR user_id = auth.uid()
  );

-- Owner may UPDATE description/photos/location/last_seen only. Status via RPC.
DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'description', 'photo_urls', 'photo_url', 'location_address',
    'latitude', 'longitude', 'last_seen_at'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = col
    ) THEN
      EXECUTE format('GRANT UPDATE (%I) ON public.reports TO authenticated', col);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS reports_owner_edit ON public.reports;
CREATE POLICY reports_owner_edit ON public.reports FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND status IN ('pending_moderation', 'pending', 'active', 'open', 'rejected', 'resolved')
  )
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.reports_owner_edit_moderation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.description IS DISTINCT FROM OLD.description
     OR NEW.photo_urls IS DISTINCT FROM OLD.photo_urls
     OR NEW.photo_url IS DISTINCT FROM OLD.photo_url
     OR NEW.location_address IS DISTINCT FROM OLD.location_address
     OR NEW.latitude IS DISTINCT FROM OLD.latitude
     OR NEW.longitude IS DISTINCT FROM OLD.longitude
     OR NEW.last_seen_at IS DISTINCT FROM OLD.last_seen_at THEN
    NEW.status := 'pending_moderation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_owner_edit_moderation ON public.reports;
CREATE TRIGGER reports_owner_edit_moderation
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL AND NEW.user_id = OLD.user_id)
  EXECUTE FUNCTION public.reports_owner_edit_moderation();

DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'moderator_note', 'resolution_outcome', 'resolved_at', 'cancel_reason',
    'cancelled_at', 'last_boosted_at'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reports' AND column_name = col
    ) THEN
      EXECUTE format('GRANT SELECT (%I) ON public.reports TO anon, authenticated', col);
    END IF;
  END LOOP;
END $$;

-- Attach anon reports filed with this phone once the number is verified.
CREATE OR REPLACE FUNCTION public.claim_my_anon_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  digits text;
  n int := 0;
BEGIN
  IF uid IS NULL THEN RETURN 0; END IF;
  SELECT right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
    INTO digits
    FROM public.user_verifications
   WHERE user_id = uid AND phone_verified = true;
  IF digits IS NULL OR length(digits) < 7 THEN RETURN 0; END IF;

  UPDATE public.reports
     SET user_id = uid
   WHERE user_id IS NULL
     AND right(regexp_replace(coalesce(contact_phone, ''), '\D', '', 'g'), 10) = digits;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN
    BEGIN
      INSERT INTO public.audit_log (actor_id, action, acting_as, target_type, subject_type, detail)
      VALUES (uid, 'report.claim_anon', 'self', 'report', 'report', jsonb_build_object('count', n));
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
  RETURN n;
EXCEPTION WHEN undefined_table THEN
  RETURN 0;
WHEN undefined_column THEN
  RETURN 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_my_anon_reports() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_my_anon_reports() FROM anon, public;

-- Owner status + edit + boost. Writes audit_log.
CREATE OR REPLACE FUNCTION public.update_my_report(p_id uuid, p_action text, p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rec public.reports%ROWTYPE;
  act text := lower(coalesce(p_action, ''));
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
  helpers int := 0;
  gh text;
  outcome text;
  reason text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sign_in_required');
  END IF;
  SELECT * INTO rec FROM public.reports WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF rec.user_id IS DISTINCT FROM uid AND NOT public.is_platform_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;

  IF act = 'edit' THEN
    IF rec.status IN ('cancelled', 'closed') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'closed');
    END IF;
    UPDATE public.reports SET
      description = coalesce(nullif(payload->>'description', ''), description),
      location_address = coalesce(nullif(payload->>'location_address', ''), location_address),
      latitude = CASE WHEN payload ? 'latitude' THEN (payload->>'latitude')::double precision ELSE latitude END,
      longitude = CASE WHEN payload ? 'longitude' THEN (payload->>'longitude')::double precision ELSE longitude END,
      last_seen_at = CASE
        WHEN payload ? 'last_seen_at' AND nullif(payload->>'last_seen_at', '') IS NULL THEN NULL
        WHEN payload ? 'last_seen_at' THEN (payload->>'last_seen_at')::timestamptz
        ELSE last_seen_at
      END,
      photo_urls = CASE WHEN payload ? 'photo_urls' THEN ARRAY(SELECT jsonb_array_elements_text(payload->'photo_urls')) ELSE photo_urls END,
      photo_url = CASE WHEN payload ? 'photo_url' THEN nullif(payload->>'photo_url', '') ELSE photo_url END,
      status = 'pending_moderation'
    WHERE id = p_id;
    BEGIN
      INSERT INTO public.audit_log (actor_id, action, acting_as, target_type, target_id, subject_type, subject_id, detail)
      VALUES (uid, 'report.edit', 'self', 'report', p_id, 'report', p_id, payload);
    EXCEPTION WHEN others THEN NULL;
    END;
    RETURN jsonb_build_object('ok', true, 'status', 'pending_moderation');
  END IF;

  IF act = 'resolve' THEN
    IF rec.status IN ('cancelled', 'closed') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'closed');
    END IF;
    outcome := lower(coalesce(payload->>'outcome', ''));
    IF outcome NOT IN ('found', 'rescued', 'no_longer_needed') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'outcome_required');
    END IF;
    UPDATE public.reports SET
      status = 'resolved',
      resolution_outcome = outcome,
      resolved_at = now()
    WHERE id = p_id;
    BEGIN
      INSERT INTO public.audit_log (actor_id, action, acting_as, target_type, target_id, subject_type, subject_id, detail)
      VALUES (uid, 'report.resolve', 'self', 'report', p_id, 'report', p_id, jsonb_build_object('outcome', outcome));
    EXCEPTION WHEN others THEN NULL;
    END;
    RETURN jsonb_build_object('ok', true, 'status', 'resolved', 'outcome', outcome);
  END IF;

  IF act = 'cancel' THEN
    IF rec.status IN ('cancelled', 'closed') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'closed');
    END IF;
    reason := nullif(btrim(coalesce(payload->>'reason', '')), '');
    IF reason IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'reason_required');
    END IF;
    UPDATE public.reports SET
      status = 'cancelled',
      cancel_reason = reason,
      cancelled_at = now()
    WHERE id = p_id;
    BEGIN
      INSERT INTO public.audit_log (actor_id, action, acting_as, target_type, target_id, subject_type, subject_id, detail)
      VALUES (uid, 'report.cancel', 'self', 'report', p_id, 'report', p_id, jsonb_build_object('reason', reason));
    EXCEPTION WHEN others THEN NULL;
    END;
    RETURN jsonb_build_object('ok', true, 'status', 'cancelled');
  END IF;

  IF act = 'boost' THEN
    IF rec.status NOT IN ('active', 'open') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_live');
    END IF;
    IF rec.last_boosted_at IS NOT NULL AND rec.last_boosted_at > now() - interval '24 hours' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'boost_cooldown',
        'next_at', rec.last_boosted_at + interval '24 hours');
    END IF;
    gh := nullif(payload->>'geohash', '');
    UPDATE public.reports SET last_boosted_at = now() WHERE id = p_id;
    BEGIN
      IF gh IS NOT NULL AND length(gh) >= 4 THEN
        SELECT count(*)::int INTO helpers
          FROM public.helper_status
         WHERE on_duty = true
           AND (until_at IS NULL OR until_at > now())
           AND geohash IS NOT NULL
           AND left(geohash, 4) = left(gh, 4);
      END IF;
    EXCEPTION WHEN others THEN
      helpers := 0;
    END;
    BEGIN
      INSERT INTO public.audit_log (actor_id, action, acting_as, target_type, target_id, subject_type, subject_id, detail)
      VALUES (uid, 'report.boost', 'self', 'report', p_id, 'report', p_id,
              jsonb_build_object('helpers', helpers, 'geohash', gh));
    EXCEPTION WHEN others THEN NULL;
    END;
    RETURN jsonb_build_object('ok', true, 'helpers_notified', helpers);
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', 'unknown_action');
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_report(uuid, text, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_report(uuid, text, jsonb) FROM anon, public;
