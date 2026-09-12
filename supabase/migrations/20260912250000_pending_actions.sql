-- pending_actions(): share/transfer invites + unreviewed docs + open help requests.
-- Paste once. Idempotent. Used by the header avatar badge.

CREATE OR REPLACE FUNCTION public.pending_actions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  em text;
  n int := 0;
BEGIN
  IF uid IS NULL THEN RETURN 0; END IF;
  em := lower(coalesce(auth.jwt()->>'email', ''));

  SELECT
    COALESCE((
      SELECT count(*)::int FROM public.pet_share_invites i
      WHERE i.status = 'pending'
        AND (i.expires_at IS NULL OR i.expires_at > now())
        AND i.invited_email IS NOT NULL
        AND lower(i.invited_email) = em
    ), 0)
    + COALESCE((
      SELECT count(*)::int FROM public.pet_transfers t
      WHERE t.status = 'pending' AND t.to_user = uid
    ), 0)
    + COALESCE((
      SELECT count(*)::int FROM public.help_requests h
      WHERE h.status = 'pending' AND h.helper_id = uid
    ), 0)
    + COALESCE((
      SELECT count(*)::int FROM public.pet_documents d
      WHERE d.ai_status IN ('ready', 'partial', 'parsed')
        AND coalesce(d.ai_summary->>'applied', '') IS DISTINCT FROM 'true'
        AND d.ai_status IS DISTINCT FROM 'confirmed'
        AND (
          EXISTS (SELECT 1 FROM public.pets p WHERE p.id = d.pet_id AND p.owner_id = uid)
          OR EXISTS (
            SELECT 1 FROM public.pet_relationships r
            WHERE r.pet_id = d.pet_id AND r.user_id = uid AND r.ended_on IS NULL
          )
        )
    ), 0)
  INTO n;

  RETURN COALESCE(n, 0);
EXCEPTION WHEN undefined_table THEN
  RETURN 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pending_actions() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.pending_actions() FROM anon, public;
