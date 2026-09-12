-- Community pets (listing_type = 'community') + ownership transfer.
-- Also finishes insurance_claims patch if that table exists.
-- Paste once. Idempotent.

-- ---------------------------------------------------------------------------
-- 0. Optional insurance_claims (may not exist on this project)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'insurance_claims'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.insurance_claims ALTER COLUMN policy_id DROP NOT NULL';
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
    EXECUTE 'ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS pet_invoice_id uuid REFERENCES public.pet_invoices(id) ON DELETE SET NULL';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Community fields on pets
-- ---------------------------------------------------------------------------
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS territory text;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS geohash text;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS feeding_schedule text;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS tnr_status text;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS colony_id uuid;

DO $$
BEGIN
  ALTER TABLE public.pets DROP CONSTRAINT IF EXISTS pets_tnr_status_check;
  ALTER TABLE public.pets ADD CONSTRAINT pets_tnr_status_check
    CHECK (tnr_status IS NULL OR tnr_status IN ('unknown', 'scheduled', 'done'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.pet_colonies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  territory text,
  geohash text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  ALTER TABLE public.pets DROP CONSTRAINT IF EXISTS pets_colony_id_fkey;
  ALTER TABLE public.pets
    ADD CONSTRAINT pets_colony_id_fkey
    FOREIGN KEY (colony_id) REFERENCES public.pet_colonies(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS pets_community_geohash
  ON public.pets (geohash)
  WHERE listing_type = 'community';

ALTER TABLE public.pet_colonies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pet_colonies_read ON public.pet_colonies;
CREATE POLICY pet_colonies_read ON public.pet_colonies
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pet_colonies_write ON public.pet_colonies;
CREATE POLICY pet_colonies_write ON public.pet_colonies
  FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_platform_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.pet_colonies TO authenticated;

GRANT SELECT (territory, geohash, feeding_schedule, tnr_status, colony_id) ON public.pets TO authenticated;
GRANT UPDATE (territory, geohash, feeding_schedule, tnr_status, colony_id, listing_type, owner_id) ON public.pets TO authenticated;

DROP POLICY IF EXISTS pets_community_select ON public.pets;
CREATE POLICY pets_community_select ON public.pets
  FOR SELECT TO authenticated
  USING (listing_type = 'community');

-- ---------------------------------------------------------------------------
-- 2. previous_owner + 30-day read grace
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.pet_relationships DROP CONSTRAINT IF EXISTS pet_relationships_relationship_check;
  ALTER TABLE public.pet_relationships ADD CONSTRAINT pet_relationships_relationship_check
    CHECK (relationship IN (
      'owner','own','foster','sponsor','sponsored','co_owner','co-owner',
      'caretaker','adopter','veterinarian','previous_owner'
    ));
EXCEPTION WHEN check_violation THEN NULL;
          WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.has_pet_relationship(pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    pid IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pet_relationships pr
      WHERE pr.pet_id = pid
        AND pr.user_id = auth.uid()
        AND (
          pr.ended_on IS NULL
          OR (
            lower(pr.relationship) = 'previous_owner'
            AND pr.ended_on >= (CURRENT_DATE - 30)
          )
        )
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.pet_rel_level(pid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM pets p WHERE p.id = pid AND p.owner_id = auth.uid()) THEN 'owner'
    WHEN EXISTS (
      SELECT 1 FROM pet_relationships pr
      WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
        AND pr.relationship IN ('owner','own')
    ) THEN 'owner'
    WHEN EXISTS (
      SELECT 1 FROM pet_relationships pr
      WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
        AND pr.relationship IN ('co_owner','co-owner')
    ) THEN 'co_owner'
    WHEN EXISTS (
      SELECT 1 FROM pet_relationships pr
      WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
        AND pr.relationship = 'veterinarian'
    ) THEN 'veterinarian'
    WHEN EXISTS (
      SELECT 1 FROM pet_relationships pr
      WHERE pr.pet_id = pid AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
        AND pr.relationship IN ('caretaker','foster')
    ) THEN 'caretaker'
    WHEN EXISTS (
      SELECT 1 FROM pet_relationships pr
      WHERE pr.pet_id = pid AND pr.user_id = auth.uid()
        AND lower(pr.relationship) = 'previous_owner'
        AND pr.ended_on IS NOT NULL
        AND pr.ended_on >= (CURRENT_DATE - 30)
    ) THEN 'previous_owner'
    ELSE NULL
  END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Caretaker first name only (no email, no full last name)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.community_caretaker_name(pid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(split_part(trim(coalesce(pr.full_name, '')), ' ', 1), '')
  FROM public.pets p
  JOIN public.profiles pr ON pr.id = p.owner_id
  WHERE p.id = pid
    AND p.listing_type = 'community';
$$;
REVOKE ALL ON FUNCTION public.community_caretaker_name(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.community_caretaker_name(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Ownership transfer
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pet_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  from_user uuid NOT NULL,
  to_user uuid,
  invited_email text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
CREATE INDEX IF NOT EXISTS pet_transfers_to_pending ON public.pet_transfers (to_user, status);
CREATE INDEX IF NOT EXISTS pet_transfers_from_pending ON public.pet_transfers (from_user, status);
CREATE UNIQUE INDEX IF NOT EXISTS pet_transfers_one_pending
  ON public.pet_transfers (pet_id)
  WHERE status = 'pending';

ALTER TABLE public.pet_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pet_transfers_select ON public.pet_transfers;
CREATE POLICY pet_transfers_select ON public.pet_transfers
  FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid() OR public.is_platform_admin());
DROP POLICY IF EXISTS pet_transfers_insert ON public.pet_transfers;
CREATE POLICY pet_transfers_insert ON public.pet_transfers
  FOR INSERT TO authenticated
  WITH CHECK (from_user = auth.uid() AND public.can_manage_pet(pet_id));
DROP POLICY IF EXISTS pet_transfers_update ON public.pet_transfers;
CREATE POLICY pet_transfers_update ON public.pet_transfers
  FOR UPDATE TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid() OR public.is_platform_admin())
  WITH CHECK (from_user = auth.uid() OR to_user = auth.uid() OR public.is_platform_admin());

GRANT SELECT, INSERT, UPDATE ON public.pet_transfers TO authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    WHERE c.contype = 'c' AND n.nspname = 'public' AND cl.relname = 'adoption_history'
      AND pg_get_constraintdef(c.oid) ILIKE '%event%'
  LOOP
    EXECUTE format('ALTER TABLE public.adoption_history DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
  ALTER TABLE public.adoption_history ADD CONSTRAINT adoption_history_event_check
    CHECK (event IN ('adopted', 'returned', 'foster_placement', 'ownership_transferred'));
EXCEPTION WHEN duplicate_object THEN NULL;
          WHEN undefined_table THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.create_pet_transfer(p_pet_id uuid, p_email text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from uuid := auth.uid();
  v_to uuid;
  v_token text;
  v_id uuid;
  v_email text;
BEGIN
  IF v_from IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sign_in_required');
  END IF;
  IF NOT public.can_manage_pet(p_pet_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pets p WHERE p.id = p_pet_id AND p.owner_id = v_from) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_owner');
  END IF;
  v_email := nullif(lower(trim(coalesce(p_email, ''))), '');
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_to FROM public.profiles WHERE lower(coalesce(email, '')) = v_email LIMIT 1;
  END IF;
  IF v_to IS NOT NULL AND v_to = v_from THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self');
  END IF;
  UPDATE public.pet_transfers
     SET status = 'cancelled'
   WHERE pet_id = p_pet_id AND status = 'pending';
  INSERT INTO public.pet_transfers (pet_id, from_user, to_user, invited_email, note)
  VALUES (p_pet_id, v_from, v_to, v_email, nullif(trim(coalesce(p_note, '')), ''))
  RETURNING id, token INTO v_id, v_token;
  RETURN jsonb_build_object('ok', true, 'id', v_id, 'token', v_token, 'to_user', v_to);
END;
$$;
REVOKE ALL ON FUNCTION public.create_pet_transfer(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pet_transfer(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.peek_pet_transfer(tok text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.pet_transfers%ROWTYPE;
  pname text;
  photo text;
BEGIN
  IF tok IS NULL OR length(trim(tok)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;
  SELECT * INTO t FROM public.pet_transfers WHERE token = tok;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;
  SELECT p.name, p.main_photo_url INTO pname, photo FROM public.pets p WHERE p.id = t.pet_id;
  IF t.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', t.status, 'status', t.status, 'pet_id', t.pet_id, 'pet_name', pname);
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'kind', 'transfer',
    'pet_id', t.pet_id,
    'pet_name', pname,
    'pet_photo', photo,
    'note', t.note,
    'status', t.status
  );
END;
$$;
REVOKE ALL ON FUNCTION public.peek_pet_transfer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_pet_transfer(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.transfer_pet(p_pet_id uuid, p_to_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from uuid;
  v_from_name text;
  v_to_name text;
  v_pending uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sign_in_required');
  END IF;
  IF p_to_user IS NULL OR p_pet_id IS NULL OR auth.uid() IS DISTINCT FROM p_to_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_recipient');
  END IF;
  SELECT owner_id INTO v_from FROM public.pets WHERE id = p_pet_id;
  IF v_from IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_from = p_to_user THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_owner');
  END IF;
  SELECT id INTO v_pending
  FROM public.pet_transfers
  WHERE pet_id = p_pet_id
    AND from_user = v_from
    AND status = 'pending'
    AND (to_user = p_to_user OR to_user IS NULL)
  LIMIT 1;
  IF v_pending IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_pending_transfer');
  END IF;

  UPDATE public.pets SET owner_id = p_to_user WHERE id = p_pet_id;

  UPDATE public.pet_relationships
     SET ended_on = CURRENT_DATE,
         relationship = 'previous_owner'
   WHERE pet_id = p_pet_id
     AND user_id = v_from
     AND ended_on IS NULL
     AND lower(relationship) IN ('owner', 'own');

  IF NOT FOUND THEN
    INSERT INTO public.pet_relationships (pet_id, user_id, relationship, started_on, ended_on)
    VALUES (p_pet_id, v_from, 'previous_owner', CURRENT_DATE, CURRENT_DATE);
  END IF;

  INSERT INTO public.pet_relationships (pet_id, user_id, relationship, started_on)
  SELECT p_pet_id, p_to_user, 'owner', CURRENT_DATE
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pet_relationships pr
    WHERE pr.pet_id = p_pet_id
      AND pr.user_id = p_to_user
      AND pr.ended_on IS NULL
      AND lower(pr.relationship) IN ('owner', 'own')
  );

  SELECT NULLIF(split_part(trim(coalesce(full_name, '')), ' ', 1), '') INTO v_from_name
  FROM public.profiles WHERE id = v_from;
  SELECT NULLIF(split_part(trim(coalesce(full_name, '')), ' ', 1), '') INTO v_to_name
  FROM public.profiles WHERE id = p_to_user;

  BEGIN
    INSERT INTO public.adoption_history (pet_id, event, note)
    VALUES (
      p_pet_id,
      'ownership_transferred',
      'Ownership transferred from ' || coalesce(v_from_name, 'previous owner') ||
        ' to ' || coalesce(v_to_name, 'new owner')
    );
  EXCEPTION WHEN others THEN NULL;
  END;

  BEGIN
    INSERT INTO public.audit_log (actor_id, action, subject_type, subject_id, detail)
    VALUES (
      p_to_user,
      'transfer_pet',
      'pet',
      p_pet_id,
      jsonb_build_object('from_user', v_from, 'to_user', p_to_user)
    );
  EXCEPTION WHEN others THEN NULL;
  END;

  UPDATE public.pet_transfers
     SET status = 'accepted', accepted_at = now(), to_user = p_to_user
   WHERE id = v_pending;

  RETURN jsonb_build_object('ok', true, 'pet_id', p_pet_id);
END;
$$;
REVOKE ALL ON FUNCTION public.transfer_pet(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_pet(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_pet_transfer(tok text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t public.pet_transfers%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sign_in_required');
  END IF;
  SELECT * INTO t FROM public.pet_transfers WHERE token = tok;
  IF NOT FOUND OR t.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;
  IF t.to_user IS NOT NULL AND t.to_user IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_recipient');
  END IF;
  UPDATE public.pet_transfers SET to_user = auth.uid() WHERE id = t.id AND to_user IS NULL;
  RETURN public.transfer_pet(t.pet_id, auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.accept_pet_transfer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_pet_transfer(text) TO authenticated;
