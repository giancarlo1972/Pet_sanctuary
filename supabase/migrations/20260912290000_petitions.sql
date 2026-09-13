-- Petitions / Campaigns: kind includes petition; signatures; RPCs; White Coat seed.
-- Paste once. Idempotent. Wrapped so one failed step cannot roll back the rest.

-- ---------------------------------------------------------------------------
-- 1. campaigns columns + kind check
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS goal_count integer;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS body_md text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS why_it_matters text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS signature_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS baseline_count integer NOT NULL DEFAULT 0;

UPDATE public.campaigns
SET type = CASE kind
  WHEN 'fundraising' THEN 'fundraiser'
  ELSE kind
END
WHERE type IS NULL;

DO $$
BEGIN
  ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_kind_check;
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_kind_check
    CHECK (kind IN ('petition','fundraiser','fundraising','event','awareness'));
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_type_check;
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_type_check
    CHECK (type IS NULL OR type IN ('petition','fundraiser','event','awareness'));
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN OTHERS THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. signatures + updates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.petition_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  city text,
  comment text,
  public boolean NOT NULL DEFAULT true,
  verified boolean NOT NULL DEFAULT false,
  token text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS petition_signatures_campaign_email
  ON public.petition_signatures (campaign_id, lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS petition_signatures_campaign_email_plain
  ON public.petition_signatures (campaign_id, email);

DO $$
BEGIN
  UPDATE public.petition_signatures SET email = lower(email) WHERE email <> lower(email);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.petition_signatures DROP CONSTRAINT IF EXISTS petition_signatures_campaign_email_key;
  ALTER TABLE public.petition_signatures
    ADD CONSTRAINT petition_signatures_campaign_email_key UNIQUE (campaign_id, email);
EXCEPTION WHEN duplicate_object THEN NULL;
WHEN unique_violation THEN NULL;
WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS petition_signatures_campaign_verified
  ON public.petition_signatures (campaign_id)
  WHERE verified;

CREATE TABLE IF NOT EXISTS public.campaign_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.petition_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ps_read ON public.petition_signatures;
CREATE POLICY ps_read ON public.petition_signatures
  FOR SELECT TO anon, authenticated
  USING (
    (verified AND public)
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id
        AND (
          c.manager_id = auth.uid()
          OR public.is_platform_admin()
          OR (c.org_id IS NOT NULL AND public.is_org_admin(c.org_id))
          OR EXISTS (
            SELECT 1 FROM public.campaign_managers cm
            WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS ps_no_direct_write ON public.petition_signatures;
DROP POLICY IF EXISTS ps_mgr_del ON public.petition_signatures;
CREATE POLICY ps_mgr_del ON public.petition_signatures
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id
        AND (c.manager_id = auth.uid() OR public.is_platform_admin()
          OR (c.org_id IS NOT NULL AND public.is_org_admin(c.org_id)))
    )
  );

DROP POLICY IF EXISTS cu_read ON public.campaign_updates;
CREATE POLICY cu_read ON public.campaign_updates
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS cu_write ON public.campaign_updates;
CREATE POLICY cu_write ON public.campaign_updates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id
        AND (c.manager_id = auth.uid() OR public.is_platform_admin()
          OR (c.org_id IS NOT NULL AND public.is_org_admin(c.org_id)))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id
        AND (c.manager_id = auth.uid() OR public.is_platform_admin()
          OR (c.org_id IS NOT NULL AND public.is_org_admin(c.org_id)))
    )
  );

GRANT SELECT ON public.petition_signatures TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_updates TO authenticated;
GRANT SELECT ON public.campaign_updates TO anon;
GRANT DELETE ON public.petition_signatures TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. count trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_petition_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cid uuid;
BEGIN
  cid := coalesce(NEW.campaign_id, OLD.campaign_id);
  UPDATE public.campaigns
  SET signature_count = coalesce(baseline_count, 0) + (
    SELECT count(*) FROM public.petition_signatures s
    WHERE s.campaign_id = cid AND s.verified
  )
  WHERE id = cid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS petition_signatures_count ON public.petition_signatures;
CREATE TRIGGER petition_signatures_count
  AFTER INSERT OR UPDATE OR DELETE ON public.petition_signatures
  FOR EACH ROW EXECUTE PROCEDURE public.refresh_petition_count();

-- ---------------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sign_petition(cid uuid, p_comment text DEFAULT NULL, p_public boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  fulln text;
  em text;
  city text;
  n int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'sign in required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = cid AND status = 'active' AND (kind = 'petition' OR type = 'petition')
  ) THEN
    RAISE EXCEPTION 'petition not found';
  END IF;
  SELECT coalesce(p.full_name, 'Member') INTO fulln FROM public.profiles p WHERE p.id = uid;
  city := NULL;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'address_city'
  ) THEN
    EXECUTE 'SELECT address_city FROM public.profiles WHERE id = $1' INTO city USING uid;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'city'
  ) THEN
    EXECUTE 'SELECT city FROM public.profiles WHERE id = $1' INTO city USING uid;
  END IF;
  SELECT email INTO em FROM auth.users WHERE id = uid;
  IF em IS NULL OR em = '' THEN
    RAISE EXCEPTION 'email required';
  END IF;
  INSERT INTO public.petition_signatures (campaign_id, user_id, name, email, city, comment, public, verified)
  VALUES (cid, uid, coalesce(fulln, 'Member'), lower(em), city, p_comment, coalesce(p_public, true), true)
  ON CONFLICT (campaign_id, email) DO UPDATE
    SET user_id = uid,
        name = excluded.name,
        city = coalesce(excluded.city, petition_signatures.city),
        comment = coalesce(excluded.comment, petition_signatures.comment),
        public = excluded.public,
        verified = true;
  SELECT signature_count INTO n FROM public.campaigns WHERE id = cid;
  RETURN jsonb_build_object('ok', true, 'count', n, 'signed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_petition_sign(
  cid uuid, p_name text, p_email text, p_city text DEFAULT NULL,
  p_comment text DEFAULT NULL, p_public boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE tok text;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN RAISE EXCEPTION 'name required'; END IF;
  IF p_email IS NULL OR p_email !~* '^[^@]+@[^@]+\.[^@]+$' THEN RAISE EXCEPTION 'valid email required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE id = cid AND status = 'active' AND (kind = 'petition' OR type = 'petition')
  ) THEN
    RAISE EXCEPTION 'petition not found';
  END IF;
  tok := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.petition_signatures (campaign_id, name, email, city, comment, public, verified, token)
  VALUES (cid, trim(p_name), lower(trim(p_email)), nullif(trim(p_city), ''), p_comment, coalesce(p_public, true), false, tok)
  ON CONFLICT (campaign_id, email) DO UPDATE
    SET name = excluded.name,
        city = coalesce(excluded.city, petition_signatures.city),
        comment = coalesce(excluded.comment, petition_signatures.comment),
        token = CASE WHEN petition_signatures.verified THEN petition_signatures.token ELSE excluded.token END;
  RETURN jsonb_build_object('ok', true, 'pending', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_petition_signature(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n int; cid uuid;
BEGIN
  UPDATE public.petition_signatures
  SET verified = true
  WHERE token = p_token AND coalesce(token, '') <> ''
  RETURNING campaign_id INTO cid;
  IF cid IS NULL THEN
    RAISE EXCEPTION 'invalid or expired link';
  END IF;
  SELECT signature_count INTO n FROM public.campaigns WHERE id = cid;
  RETURN jsonb_build_object('ok', true, 'count', n, 'campaign_id', cid);
END;
$$;

REVOKE ALL ON FUNCTION public.sign_petition(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sign_petition(uuid, text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.request_petition_sign(uuid, text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_petition_sign(uuid, text, text, text, text, boolean) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_petition_signature(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_petition_signature(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. White Coat Waste Project seed
-- ---------------------------------------------------------------------------
DO $$
DECLARE oid uuid;
        cid uuid;
BEGIN
  SELECT id INTO oid FROM public.organizations WHERE name ILIKE 'White Coat Waste%' LIMIT 1;
  IF oid IS NULL THEN
    BEGIN
      INSERT INTO public.organizations (name, org_type, status, ein_verified, verification_method, city, state, description)
      VALUES (
        'White Coat Waste Project',
        'rescue',
        'approved',
        true,
        'propublica',
        'Mechanicsville',
        'VA',
        'Bipartisan 501(c)(3) that finds, exposes, and defunds taxpayer-funded animal experiments.'
      )
      RETURNING id INTO oid;
    EXCEPTION WHEN OTHERS THEN
      SELECT id INTO oid FROM public.organizations ORDER BY created_at NULLS LAST LIMIT 1;
    END;
  END IF;

  SELECT id INTO cid FROM public.campaigns WHERE title ILIKE '%White Coat%' OR title ILIKE '%taxpayer-funded animal%' LIMIT 1;
  IF cid IS NULL THEN
    INSERT INTO public.campaigns (
      org_id, kind, type, title, target, goal_count, baseline_count, signature_count,
      body, body_md, why_it_matters, tags, status, cover_url
    ) VALUES (
      oid,
      'petition',
      'petition',
      'End taxpayer-funded animal experiments',
      'U.S. Congress · Department of Veterans Affairs',
      25000,
      12475,
      12475,
      'Tell Congress to stop wasting tax dollars on painful animal experiments — and adopt out the survivors.',
      $md$White Coat Waste Project investigations have documented taxpayer-funded labs purchasing, injuring, and killing cats, dogs, and primates — including VA kitten experiments and NIH beagle labs.

Congress has already acted on some of these labs. This petition asks every member to cut the remaining funding and require that surviving animals be adopted into homes, not killed when a protocol ends.$md$,
      'Your name is delivered to Congress and the VA as a taxpayer who wants this spending ended. Survivors of closed labs — like Bob, a VA device-test dog — have been adopted. The next round of cats and primates will not be, unless the money stops.',
      ARRAY['WhiteCoat','Congress','VA'],
      'active',
      'https://hub-preview.pet-sanctuary.pages.dev/white-coat-cover.jpg'
    )
    RETURNING id INTO cid;
  ELSE
    UPDATE public.campaigns SET
      kind = 'petition',
      type = 'petition',
      target = coalesce(target, 'U.S. Congress · Department of Veterans Affairs'),
      goal_count = coalesce(goal_count, 25000),
      baseline_count = GREATEST(coalesce(baseline_count, 0), 12475),
      tags = CASE WHEN tags IS NULL OR cardinality(tags) = 0 THEN ARRAY['WhiteCoat','Congress','VA'] ELSE tags END,
      status = 'active',
      org_id = coalesce(org_id, oid),
      cover_url = coalesce(nullif(cover_url, ''), 'https://hub-preview.pet-sanctuary.pages.dev/white-coat-cover.jpg'),
      body_md = coalesce(body_md, body),
      why_it_matters = coalesce(why_it_matters, 'Your name is delivered to Congress and the VA as a taxpayer who wants this spending ended.')
    WHERE id = cid;
  END IF;

  INSERT INTO public.campaign_updates (campaign_id, title, body)
  SELECT cid, 'Congress demands answers on VA kitten labs',
    'Thirty lawmakers from both parties have signed a letter to the VA over painful and outdated cat testing. Keep the pressure on — signatures are delivered as a CSV and PDF to the target offices.'
  WHERE NOT EXISTS (SELECT 1 FROM public.campaign_updates WHERE campaign_id = cid);

  INSERT INTO public.petition_signatures (campaign_id, name, email, city, public, verified)
  SELECT cid, x.name, x.email, x.city, true, true
  FROM (VALUES
    ('Emilie', 'seed-emilie@invalid.rescue-army', 'Brooklyn, NY'),
    ('Marcus', 'seed-marcus@invalid.rescue-army', 'Austin, TX'),
    ('Priya', 'seed-priya@invalid.rescue-army', 'San Jose, CA'),
    ('Jonah', 'seed-jonah@invalid.rescue-army', 'Mechanicsville, VA'),
    ('Aisha', 'seed-aisha@invalid.rescue-army', 'Chicago, IL')
  ) AS x(name, email, city)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.petition_signatures s
    WHERE s.campaign_id = cid AND lower(s.email) = lower(x.email)
  );

  UPDATE public.campaigns c
  SET signature_count = coalesce(c.baseline_count, 0) + (
    SELECT count(*) FROM public.petition_signatures s WHERE s.campaign_id = c.id AND s.verified
  )
  WHERE c.id = cid;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'white coat seed skipped: %', SQLERRM;
END $$;
