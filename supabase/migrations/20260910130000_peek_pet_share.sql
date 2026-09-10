-- Invitee can preview a share invite by token (anon + signed-in).
-- accept_pet_share stays authenticated-only; made idempotent so a unique
-- relationship row no longer leaves the invite stuck on pending.

CREATE OR REPLACE FUNCTION public.peek_pet_share(tok text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.pet_share_invites%ROWTYPE;
  pname text;
  photo text;
BEGIN
  IF tok IS NULL OR length(trim(tok)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;
  SELECT * INTO inv FROM public.pet_share_invites WHERE token = tok;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;
  IF inv.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', inv.status, 'status', inv.status, 'pet_id', inv.pet_id, 'level', inv.level);
  END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired', 'status', 'expired');
  END IF;
  SELECT p.name, p.main_photo_url INTO pname, photo FROM public.pets p WHERE p.id = inv.pet_id;
  RETURN jsonb_build_object(
    'ok', true,
    'pet_id', inv.pet_id,
    'pet_name', pname,
    'pet_photo', photo,
    'level', inv.level,
    'status', inv.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.peek_pet_share(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_pet_share(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_pet_share(tok text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.pet_share_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sign_in_required');
  END IF;
  SELECT * INTO inv FROM public.pet_share_invites WHERE token = tok;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired');
  END IF;
  IF inv.status = 'accepted' AND inv.accepted_user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', true, 'pet_id', inv.pet_id, 'level', inv.level, 'already', true);
  END IF;
  IF inv.status IS DISTINCT FROM 'pending' OR (inv.expires_at IS NOT NULL AND inv.expires_at <= now()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_expired', 'status', inv.status);
  END IF;

  INSERT INTO public.pet_relationships (pet_id, user_id, relationship, started_on)
  SELECT inv.pet_id, auth.uid(), inv.level, current_date
  WHERE NOT EXISTS (
    SELECT 1 FROM public.pet_relationships pr
    WHERE pr.pet_id = inv.pet_id
      AND pr.user_id = auth.uid()
      AND pr.ended_on IS NULL
      AND lower(pr.relationship) = lower(inv.level)
  );

  UPDATE public.pet_share_invites
     SET status = 'accepted', accepted_user_id = auth.uid()
   WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'pet_id', inv.pet_id, 'level', inv.level);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_pet_share(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_pet_share(text) TO authenticated;
