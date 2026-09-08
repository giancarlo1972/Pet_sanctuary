-- Role categories, onboarding, service marketplace, campaigns.
-- Run in Supabase SQL Editor. Idempotent.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_categories text[] NOT NULL DEFAULT ARRAY['owner'];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_done boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pet_owner_active boolean NOT NULL DEFAULT true;

-- Current members already use the app — skip the new step.
UPDATE profiles SET onboarding_done = true WHERE onboarding_done IS NOT TRUE;

UPDATE profiles p
   SET role_categories = CASE
     WHEN EXISTS (
       SELECT 1 FROM organization_members om
        WHERE om.user_id = p.id AND om.role = 'admin'
     ) AND NOT ('organization' = ANY (p.role_categories))
     THEN p.role_categories || ARRAY['organization']
     ELSE p.role_categories
   END;

GRANT UPDATE (
  role_categories, onboarding_done, pet_owner_active,
  volunteer_active, responder_active, alert_radius_mi
) ON public.profiles TO authenticated;

CREATE TABLE IF NOT EXISTS service_provider_profiles (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  services text[] NOT NULL DEFAULT '{}',
  bio text, rate_text text, radius_mi int NOT NULL DEFAULT 10,
  availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified boolean NOT NULL DEFAULT false, rating numeric, reviews_count int NOT NULL DEFAULT 0,
  show_on_map boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE service_provider_profiles ADD COLUMN IF NOT EXISTS show_on_map boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS service_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pet_id uuid REFERENCES pets(id) ON DELETE SET NULL,
  service text NOT NULL, starts_at timestamptz NOT NULL, ends_at timestamptz,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','declined','completed','cancelled')),
  note text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES service_bookings(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL, reviewer_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5), body text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('fundraising','event','awareness')),
  title text NOT NULL, body text, goal_amount numeric, raised_amount numeric NOT NULL DEFAULT 0,
  starts_at timestamptz, ends_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','ended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_managers (
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'manager', PRIMARY KEY (campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS shared_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  to_org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service text NOT NULL, note text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('offered','active','ended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE service_provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS spp_read ON service_provider_profiles;
CREATE POLICY spp_read ON service_provider_profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS spp_public_map ON service_provider_profiles;
CREATE POLICY spp_public_map ON service_provider_profiles FOR SELECT TO anon USING (show_on_map IS TRUE);
DROP POLICY IF EXISTS spp_own ON service_provider_profiles;
CREATE POLICY spp_own ON service_provider_profiles FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS sb_parties ON service_bookings;
CREATE POLICY sb_parties ON service_bookings FOR ALL TO authenticated USING (provider_id = auth.uid() OR client_id = auth.uid()) WITH CHECK (client_id = auth.uid() OR provider_id = auth.uid());
DROP POLICY IF EXISTS sr_read ON service_reviews;
CREATE POLICY sr_read ON service_reviews FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sr_write ON service_reviews;
CREATE POLICY sr_write ON service_reviews FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid());
DROP POLICY IF EXISTS camp_read ON campaigns;
CREATE POLICY camp_read ON campaigns FOR SELECT TO anon, authenticated USING (status = 'active' OR manager_id = auth.uid() OR is_platform_admin() OR (org_id IS NOT NULL AND is_org_admin(org_id)) OR EXISTS (SELECT 1 FROM campaign_managers cm WHERE cm.campaign_id = campaigns.id AND cm.user_id = auth.uid()));
DROP POLICY IF EXISTS camp_write ON campaigns;
CREATE POLICY camp_write ON campaigns FOR ALL TO authenticated USING (manager_id = auth.uid() OR is_platform_admin() OR (org_id IS NOT NULL AND is_org_admin(org_id)) OR EXISTS (SELECT 1 FROM campaign_managers cm WHERE cm.campaign_id = campaigns.id AND cm.user_id = auth.uid())) WITH CHECK (manager_id = auth.uid() OR is_platform_admin() OR (org_id IS NOT NULL AND is_org_admin(org_id)));
DROP POLICY IF EXISTS cm_rw ON campaign_managers;
CREATE POLICY cm_rw ON campaign_managers FOR ALL TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND (c.manager_id = auth.uid() OR (c.org_id IS NOT NULL AND is_org_admin(c.org_id))))) WITH CHECK (EXISTS (SELECT 1 FROM campaigns c WHERE c.id = campaign_id AND (c.manager_id = auth.uid() OR (c.org_id IS NOT NULL AND is_org_admin(c.org_id)))));
DROP POLICY IF EXISTS ss_rw ON shared_services;
CREATE POLICY ss_rw ON shared_services FOR ALL TO authenticated USING (is_org_admin(from_org_id) OR is_org_admin(to_org_id) OR is_platform_admin()) WITH CHECK (is_org_admin(from_org_id) OR is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  service_provider_profiles, service_bookings, service_reviews,
  campaigns, campaign_managers, shared_services TO authenticated;
GRANT SELECT ON TABLE campaigns, service_provider_profiles TO anon;
