/*
# Create Care Funds and Care Fund Donations

## Summary
Creates two new tables for the Care Fund feature: `care_funds` (the fund itself)
and `care_fund_donations` (individual donations). A trigger automatically
updates `care_funds.raised_amount` whenever a donation is inserted, updated, or deleted.

## New Tables

### care_funds
- `id` (uuid, primary key)
- `name` (text, not null) — display name of the fund
- `description` (text) — what the fund covers
- `goal_amount` (numeric, not null, default 0) — fundraising goal in dollars
- `raised_amount` (numeric, not null, default 0) — current total raised, maintained by trigger
- `active` (boolean, not null, default true) — whether the fund is active
- `org_id` (uuid, nullable, references organizations) — optional owning org
- `created_at` (timestamptz, default now())

### care_fund_donations
- `id` (uuid, primary key)
- `care_fund_id` (uuid, not null, references care_funds, cascade delete)
- `user_id` (uuid, not null, default auth.uid(), references profiles, cascade delete)
- `amount` (numeric, not null) — donation amount in dollars
- `note` (text) — optional donor message
- `tax_deductible` (boolean, default true)
- `receipt_sent` (boolean, default false)
- `created_at` (timestamptz, default now())

## Security

### care_funds
- RLS enabled.
- SELECT: anyone (anon + authenticated) can read active funds — the fund total is public.
- INSERT/UPDATE/DELETE: only authenticated users who are org members (if org_id is set) can modify.
  If org_id is null (platform-wide fund), only the service role can modify (no client policies).

### care_fund_donations
- RLS enabled.
- SELECT: anyone can read (donations are public — names show on the support list).
  Note: user_id is exposed but the donor's display name is derived from profiles.
- INSERT: authenticated users can insert their own donation (user_id defaults to auth.uid()).
- UPDATE/DELETE: donors can update/delete their own donations.

### Trigger: update_care_fund_raised_amount
- AFTER INSERT/UPDATE/DELETE on care_fund_donations
- Recalculates care_funds.raised_amount = SUM(donations.amount) for the affected fund
- This keeps the raised_amount always in sync without client-side updates

## Seed Data
- Inserts one active care fund: "Emergency Care Fund", goal $5,000, raised $0
*/

-- =========================================================
-- 1. Create care_funds table
-- =========================================================

CREATE TABLE IF NOT EXISTS care_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  goal_amount numeric NOT NULL DEFAULT 0,
  raised_amount numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE care_funds ENABLE ROW LEVEL SECURITY;

-- Anyone can read active funds
DROP POLICY IF EXISTS "care_funds_select_public" ON care_funds;
CREATE POLICY "care_funds_select_public" ON care_funds
  FOR SELECT TO anon, authenticated
  USING (active = true);

-- Org members can insert funds for their org
DROP POLICY IF EXISTS "care_funds_insert_org" ON care_funds;
CREATE POLICY "care_funds_insert_org" ON care_funds
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = care_funds.org_id AND om.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM organizations o WHERE o.id = care_funds.org_id AND o.created_by = auth.uid())
    )
  );

-- Org members can update their org's funds
DROP POLICY IF EXISTS "care_funds_update_org" ON care_funds;
CREATE POLICY "care_funds_update_org" ON care_funds
  FOR UPDATE TO authenticated
  USING (
    org_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = care_funds.org_id AND om.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM organizations o WHERE o.id = care_funds.org_id AND o.created_by = auth.uid())
    )
  )
  WITH CHECK (
    org_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = care_funds.org_id AND om.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM organizations o WHERE o.id = care_funds.org_id AND o.created_by = auth.uid())
    )
  );

-- =========================================================
-- 2. Create care_fund_donations table
-- =========================================================

CREATE TABLE IF NOT EXISTS care_fund_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_fund_id uuid NOT NULL REFERENCES care_funds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  note text,
  tax_deductible boolean NOT NULL DEFAULT true,
  receipt_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE care_fund_donations ENABLE ROW LEVEL SECURITY;

-- Anyone can read donations (public support list)
DROP POLICY IF EXISTS "care_fund_donations_select_public" ON care_fund_donations;
CREATE POLICY "care_fund_donations_select_public" ON care_fund_donations
  FOR SELECT TO anon, authenticated
  USING (true);

-- Authenticated users insert their own donations
DROP POLICY IF EXISTS "care_fund_donations_insert_own" ON care_fund_donations;
CREATE POLICY "care_fund_donations_insert_own" ON care_fund_donations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Donors can update their own donations
DROP POLICY IF EXISTS "care_fund_donations_update_own" ON care_fund_donations;
CREATE POLICY "care_fund_donations_update_own" ON care_fund_donations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Donors can delete their own donations
DROP POLICY IF EXISTS "care_fund_donations_delete_own" ON care_fund_donations;
CREATE POLICY "care_fund_donations_delete_own" ON care_fund_donations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =========================================================
-- 3. Trigger: auto-update raised_amount on donations change
-- =========================================================

CREATE OR REPLACE FUNCTION update_care_fund_raised_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fund_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_fund_id := OLD.care_fund_id;
  ELSE
    v_fund_id := NEW.care_fund_id;
  END IF;

  UPDATE care_funds
  SET raised_amount = COALESCE(
    (SELECT SUM(amount) FROM care_fund_donations WHERE care_fund_id = v_fund_id),
    0
  )
  WHERE id = v_fund_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_care_fund_donations_update_raised ON care_fund_donations;
CREATE TRIGGER trg_care_fund_donations_update_raised
  AFTER INSERT OR UPDATE OR DELETE ON care_fund_donations
  FOR EACH ROW
  EXECUTE FUNCTION update_care_fund_raised_amount();

-- =========================================================
-- 4. Indexes
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_care_funds_active ON care_funds(active);
CREATE INDEX IF NOT EXISTS idx_care_fund_donations_fund_id ON care_fund_donations(care_fund_id);
CREATE INDEX IF NOT EXISTS idx_care_fund_donations_user_id ON care_fund_donations(user_id);

-- =========================================================
-- 5. Seed: Emergency Care Fund
-- =========================================================

INSERT INTO care_funds (name, description, goal_amount, raised_amount, active)
VALUES (
  'Emergency Care Fund',
  'Covers emergency vet care for reported animals',
  5000,
  0,
  true
)
ON CONFLICT DO NOTHING;
