/*
# Organization EIN verification and donation gating

## Summary

Adds EIN and verification document columns to the organizations table, creates
an ein_verifications audit table, ensures the private org-verification storage
bucket has owner-scoped policies, and adds a trigger to auto-set tax_deductible
based on ein_verified status.

## Changes

### organizations table
- `ein` (text, nullable) — Employer Identification Number, stored for later verification.
  NOT required at registration. Only added during the separate verification step.
- `verification_doc_url` (text, nullable) — path to IRS determination letter in the
  private org-verification storage bucket. Only used when auto-verification fails.

### New table: ein_verifications
- `id` (uuid PK)
- `organization_id` (uuid FK → organizations)
- `ein` (text) — the EIN submitted for verification
- `method` (text) — 'propublica' or 'determination_letter'
- `status` (text) — 'pending', 'verified', 'failed'
- `matched_name` (text, nullable) — name matched from ProPublica API
- `irs_status` (text, nullable) — status from ProPublica (e.g. 'Ruling in effect')
- `raw_response` (jsonb, nullable) — full API response for audit
- `verified_by` (uuid, nullable) — user who triggered verification
- `created_at` (timestamptz)

### Trigger: set_tax_deductible_on_ein_verified
When `ein_verified` transitions to true, automatically set `tax_deductible = true`
and `verification_method` to the method used (if not already set).

### Storage: org-verification bucket policies
Owner-scoped SELECT/INSERT/DELETE on the private org-verification bucket so only
the org creator can upload/read/delete their determination letter.

## Security
- RLS enabled on ein_verifications (owner-scoped via org membership).
- Storage policies are owner-scoped to the user's folder prefix.
- No SSN, ITIN, or personal tax ID is ever stored — only the org's EIN.
*/

-- ── Add columns to organizations ─────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'ein'
  ) THEN
    ALTER TABLE organizations ADD COLUMN ein text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'verification_doc_url'
  ) THEN
    ALTER TABLE organizations ADD COLUMN verification_doc_url text;
  END IF;
END $$;

-- ── Create ein_verifications table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ein_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ein text NOT NULL,
  method text NOT NULL DEFAULT 'propublica',
  status text NOT NULL DEFAULT 'pending',
  matched_name text,
  irs_status text,
  raw_response jsonb,
  verified_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ein_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ein_verifications" ON ein_verifications;
CREATE POLICY "select_own_ein_verifications" ON ein_verifications FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = ein_verifications.organization_id
      AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_ein_verifications" ON ein_verifications;
CREATE POLICY "insert_own_ein_verifications" ON ein_verifications FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = ein_verifications.organization_id
      AND om.user_id = auth.uid()
    )
  );

-- ── Trigger: auto-set tax_deductible when ein_verified becomes true ───────────
CREATE OR REPLACE FUNCTION set_tax_deductible_on_ein_verified()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ein_verified = true AND (OLD.ein_verified IS DISTINCT FROM true OR OLD.ein_verified IS NULL) THEN
    NEW.tax_deductible = true;
    IF NEW.verification_method IS NULL THEN
      NEW.verification_method = 'propublica';
    END IF;
    IF NEW.verified_at IS NULL THEN
      NEW.verified_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_tax_deductible ON organizations;
CREATE TRIGGER trg_set_tax_deductible
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION set_tax_deductible_on_ein_verified();

-- ── Storage: org-verification bucket policies ────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-verification', 'org-verification', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "org_verify_read_own" ON storage.objects;
CREATE POLICY "org_verify_read_own" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'org-verification' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "org_verify_insert_own" ON storage.objects;
CREATE POLICY "org_verify_insert_own" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'org-verification' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "org_verify_delete_own" ON storage.objects;
CREATE POLICY "org_verify_delete_own" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'org-verification' AND (storage.foldername(name))[1] = auth.uid()::text);
