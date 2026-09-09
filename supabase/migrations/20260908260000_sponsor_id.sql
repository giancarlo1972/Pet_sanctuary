-- Sponsor orgs can be linked to campaigns and care funds they support.
-- Run in Supabase SQL Editor. Idempotent.

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sponsor_id uuid REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE care_funds ADD COLUMN IF NOT EXISTS sponsor_id uuid REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaigns_sponsor_idx ON campaigns (sponsor_id) WHERE sponsor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS care_funds_sponsor_idx ON care_funds (sponsor_id) WHERE sponsor_id IS NOT NULL;
