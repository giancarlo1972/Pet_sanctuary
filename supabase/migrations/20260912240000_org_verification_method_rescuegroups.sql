-- RescueGroups listings are a directory source, not an IRS 501(c)(3) check.
-- Paste once. Idempotent. Prod already applied the constraint + backfill.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS verification_method text;

DO $$
BEGIN
  ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_verification_method_check;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.organizations ADD CONSTRAINT organizations_verification_method_check
    CHECK (
      verification_method IS NULL
      OR lower(verification_method) IN (
        'propublica',
        'irs',
        'determination_letter',
        'manual',
        'guidestar',
        'rescuegroups'
      )
    );
EXCEPTION WHEN others THEN NULL;
END $$;

UPDATE public.organizations
SET
  status = 'approved',
  ein_verified = true,
  verification_method = 'rescuegroups'
WHERE verification_method IS DISTINCT FROM 'rescuegroups'
  AND (
    lower(coalesce(data_source, '')) LIKE '%rescuegroup%'
    OR coalesce(external_id, '') LIKE 'rg-%'
  );

-- Column-level GRANTs: table SELECT was revoked to hide ein.
GRANT SELECT (verification_method) ON public.organizations TO anon, authenticated;
