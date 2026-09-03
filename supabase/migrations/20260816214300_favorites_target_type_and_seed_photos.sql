/*
# Migrate favorites to target_type/target_id and fix seed data

1. Favorites table changes
   - Add `target_type` (text) and `target_id` (text) columns to support
     favoriting pets, shelters, clinics, and people — not just pets.
   - Make `pet_id` nullable (was NOT NULL) so non-pet favorites can exist.
   - Drop the `pet_id` foreign key and the `(user_id, pet_id)` unique constraint
     since favorites are no longer pet-only.
   - Backfill existing rows: set target_type='pet', target_id=pet_id::text.
   - Add new unique constraint on (user_id, target_type, target_id) to
     prevent duplicate favorites of the same entity.

2. Seed data fixes — every pet's photo now matches its breed and age
   - Luna (Golden Retriever, 3yr adult) → adult Golden Retriever photo
   - Max (British Shorthair, 2yr young adult) → British Shorthair cat photo
   - Bella (Border Collie, 4yr adult) → adult Border Collie photo
   - Charlie (Beagle, 8mo puppy) → Beagle puppy photo
   - Whiskers (Persian, 10yr senior) → senior Persian cat photo
   - Buddy (Labrador, 9yr senior) → senior Labrador photo
   - Happy Paws Shelter logo → shelter photo

3. Security
   - Favorites RLS policies remain authenticated-only and owner-scoped.
   - No change to policy logic; only the constraint structure changed.
*/

-- ===== Favorites schema migration =====

ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS target_type text;
ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS target_id text;

-- Allow non-pet favorites (pet_id was NOT NULL)
ALTER TABLE public.favorites ALTER COLUMN pet_id DROP NOT NULL;

-- Remove pet-specific constraints
ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS favorites_pet_id_fkey;
ALTER TABLE public.favorites DROP CONSTRAINT IF EXISTS favorites_user_id_pet_id_key;

-- Backfill existing rows
UPDATE public.favorites
SET target_type = 'pet', target_id = pet_id::text
WHERE target_type IS NULL AND pet_id IS NOT NULL;

-- New unique constraint (one favorite per user per target)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'favorites_user_target_key'
  ) THEN
    ALTER TABLE public.favorites
      ADD CONSTRAINT favorites_user_target_key UNIQUE (user_id, target_type, target_id);
  END IF;
END $$;

-- Recreate RLS policies (idempotent)
DROP POLICY IF EXISTS "select_own_favorites" ON public.favorites;
CREATE POLICY "select_own_favorites" ON public.favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_favorites" ON public.favorites;
CREATE POLICY "insert_own_favorites" ON public.favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_favorites" ON public.favorites;
CREATE POLICY "delete_own_favorites" ON public.favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ===== Seed data: fix pet photos =====

-- Luna: Golden Retriever, 3 years (adult)
UPDATE public.pets
SET main_photo_url = 'https://images.pexels.com/photos/30810890/pexels-photo-30810890.jpeg?auto=compress&cs=tinysrgb&w=800'
WHERE name = 'Luna' AND breed = 'Golden Retriever';

-- Max: British Shorthair, 2 years (young adult)
INSERT INTO public.pets (
  id, name, breed, species, age_text, gender, status, description,
  main_photo_url, location, shelter_id, personality,
  good_with_kids, good_with_dogs, good_with_cats,
  vaccinated, spayed_neutered, microchipped
)
SELECT
  'b1000000-0000-4000-8000-000000000002',
  'Max', 'British Shorthair', 'cat', '2 years', 'male', 'available',
  'Max is a calm, affectionate cat who loves cuddles and quiet afternoons. He''s perfect for someone looking for a loving companion.',
  'https://images.pexels.com/photos/4089263/pexels-photo-4089263.jpeg?auto=compress&cs=tinysrgb&w=800',
  'New York, NY',
  (SELECT id FROM public.shelters WHERE name = 'Happy Paws Shelter' LIMIT 1),
  ARRAY['Calm', 'Affectionate', 'Independent', 'Gentle'],
  true, false, true, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.pets WHERE name = 'Max' AND breed = 'British Shorthair');

-- Bella: Border Collie, 4 years (adult)
INSERT INTO public.pets (
  id, name, breed, species, age_text, gender, status, description,
  main_photo_url, location, shelter_id, personality,
  good_with_kids, good_with_dogs, good_with_cats,
  vaccinated, spayed_neutered, microchipped
)
SELECT
  'b1000000-0000-4000-8000-000000000003',
  'Bella', 'Border Collie', 'dog', '4 years', 'female', 'available',
  'Bella is an intelligent, active dog who loves mental stimulation and physical exercise. She''s great with kids and would thrive in an active household.',
  'https://images.pexels.com/photos/28587407/pexels-photo-28587407.jpeg?auto=compress&cs=tinysrgb&w=800',
  'New York, NY',
  (SELECT id FROM public.shelters WHERE name = 'Happy Paws Shelter' LIMIT 1),
  ARRAY['Intelligent', 'Active', 'Trainable', 'Loyal'],
  true, true, false, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.pets WHERE name = 'Bella' AND breed = 'Border Collie');

-- Charlie: Beagle, 8 months (puppy)
INSERT INTO public.pets (
  id, name, breed, species, age_text, gender, status, description,
  main_photo_url, location, shelter_id, personality,
  good_with_kids, good_with_dogs, good_with_cats,
  vaccinated, spayed_neutered, microchipped
)
SELECT
  'b1000000-0000-4000-8000-000000000004',
  'Charlie', 'Beagle', 'dog', '8 months', 'male', 'available',
  'Charlie is a playful, curious puppy who loves exploring the world. He''s full of energy and would love an active family to grow up with.',
  'https://images.pexels.com/photos/4203281/pexels-photo-4203281.jpeg?auto=compress&cs=tinysrgb&w=800',
  'New York, NY',
  (SELECT id FROM public.shelters WHERE name = 'Happy Paws Shelter' LIMIT 1),
  ARRAY['Playful', 'Curious', 'Energetic', 'Friendly'],
  true, true, true, true, false, true
WHERE NOT EXISTS (SELECT 1 FROM public.pets WHERE name = 'Charlie' AND breed = 'Beagle');

-- Whiskers: Persian, 10 years (senior)
INSERT INTO public.pets (
  id, name, breed, species, age_text, gender, status, description,
  main_photo_url, location, shelter_id, personality,
  good_with_kids, good_with_dogs, good_with_cats,
  vaccinated, spayed_neutered, microchipped
)
SELECT
  'b1000000-0000-4000-8000-000000000005',
  'Whiskers', 'Persian', 'cat', '10 years', 'female', 'available',
  'Whiskers is a dignified, gentle senior cat who enjoys peaceful naps in sunny spots. She''s looking for a quiet, loving forever home.',
  'https://images.pexels.com/photos/13629270/pexels-photo-13629270.jpeg?auto=compress&cs=tinysrgb&w=800',
  'New York, NY',
  (SELECT id FROM public.shelters WHERE name = 'Happy Paws Shelter' LIMIT 1),
  ARRAY['Gentle', 'Quiet', 'Affectionate', 'Dignified'],
  true, false, true, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.pets WHERE name = 'Whiskers' AND breed = 'Persian');

-- Buddy: Labrador, 9 years (senior)
INSERT INTO public.pets (
  id, name, breed, species, age_text, gender, status, description,
  main_photo_url, location, shelter_id, personality,
  good_with_kids, good_with_dogs, good_with_cats,
  vaccinated, spayed_neutered, microchipped
)
SELECT
  'b1000000-0000-4000-8000-000000000006',
  'Buddy', 'Labrador', 'dog', '9 years', 'male', 'available',
  'Buddy is a sweet, mellow senior dog who just wants a comfy bed and someone to love. He''s house-trained and great with everyone.',
  'https://images.pexels.com/photos/38542471/pexels-photo-38542471.jpeg?auto=compress&cs=tinysrgb&w=800',
  'New York, NY',
  (SELECT id FROM public.shelters WHERE name = 'Happy Paws Shelter' LIMIT 1),
  ARRAY['Sweet', 'Mellow', 'Loyal', 'Gentle'],
  true, true, true, true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.pets WHERE name = 'Buddy' AND breed = 'Labrador');

-- ===== Shelter logo =====
UPDATE public.shelters
SET logo_url = 'https://images.pexels.com/photos/16465605/pexels-photo-16465605.jpeg?auto=compress&cs=tinysrgb&w=400'
WHERE name = 'Happy Paws Shelter';