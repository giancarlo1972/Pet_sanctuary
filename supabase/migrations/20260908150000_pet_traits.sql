-- Trait catalog for pet-record / public pet chips.
-- Run in Supabase SQL Editor. Idempotent.

CREATE TABLE IF NOT EXISTS pet_traits (
  key text PRIMARY KEY,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

INSERT INTO pet_traits (key, label, sort_order) VALUES
  ('playful', 'Playful', 10),
  ('curious', 'Curious', 20),
  ('calm', 'Calm', 30),
  ('feral', 'Feral', 40),
  ('affectionate', 'Affectionate', 50),
  ('shy', 'Shy', 60),
  ('vocal', 'Vocal', 70),
  ('independent', 'Independent', 80),
  ('gentle', 'Gentle', 90),
  ('energetic', 'Energetic', 100),
  ('good_with_kids', 'Good with kids', 110),
  ('good_with_dogs', 'Good with dogs', 120),
  ('good_with_cats', 'Good with cats', 130),
  ('house_trained', 'House trained', 140),
  ('special_needs', 'Special needs', 150)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order;

ALTER TABLE pet_traits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pet_traits_read ON pet_traits;
CREATE POLICY pet_traits_read ON pet_traits FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON pet_traits TO anon, authenticated;

GRANT SELECT (personality, is_public, listing_type, location, good_with_kids, good_with_dogs, good_with_cats) ON pets TO anon, authenticated;
GRANT UPDATE (personality, is_public, listing_type, location) ON pets TO authenticated;
