/*
# Extend pet record: seed breeds/colors, add pet_photos, weight_unit, resolved_on, document kinds

## Summary
Seeds the existing pet_breeds and pet_colors reference tables with standard
AKC dog breeds, recognized cat breeds, and common coat colors. Adds read
policies so the frontend can query them. Creates pet_photos for the gallery.
Adds weight_unit preference to profiles. Adds resolved_on to pet_conditions
for active/resolved tracking. Adds a CHECK constraint to pet_documents for
new imaging document kinds.

## Changes
1. `pet_breeds` — add sort_order column, add SELECT policy (anon+authenticated), seed ~180 dog breeds and ~60 cat breeds
2. `pet_colors` — add SELECT policy (anon+authenticated), seed ~29 coat colors
3. `pet_conditions` — add `resolved_on` date column (nullable)
4. `pet_diet` — add `updated_by` uuid column (nullable)
5. `pet_photos` — new table for gallery photos (up to 10 per pet, reorderable, profile flag)
6. `profiles` — add `weight_unit` text column default 'lb' CHECK ('kg','lb')
7. `pet_documents` — add CHECK constraint on kind for: vaccination, medical, xray, ultrasound, lab_result, imaging_other, other

## Security
- pet_breeds, pet_colors: public read, no writes
- pet_photos: public read, owner-scoped write/update/delete via pet_relationships
- All other existing policies unchanged
*/

-- ============================================================
-- 1. pet_breeds: add sort_order, add read policy, seed
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pet_breeds' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE pet_breeds ADD COLUMN sort_order int NOT NULL DEFAULT 0;
  END IF;
END $$;

DROP POLICY IF EXISTS "pet_breeds_read" ON pet_breeds;
CREATE POLICY "pet_breeds_read" ON pet_breeds FOR SELECT
  TO anon, authenticated USING (true);

GRANT SELECT ON pet_breeds TO anon, authenticated;

-- Seed dog breeds
INSERT INTO pet_breeds (species, name, sort_order)
SELECT 'dog', name, sort_order FROM (VALUES
  ('Mixed', 0), ('Unknown', 1),
  ('Labrador Retriever', 2), ('German Shepherd', 3), ('Golden Retriever', 4),
  ('French Bulldog', 5), ('Bulldog', 6), ('Poodle', 7), ('Beagle', 8),
  ('Rottweiler', 9), ('Dachshund', 10), ('German Shorthaired Pointer', 11),
  ('Yorkshire Terrier', 12), ('Boxer', 13), ('Siberian Husky', 14),
  ('Great Dane', 15), ('Doberman Pinscher', 16), ('Australian Shepherd', 17),
  ('Miniature Schnauzer', 18), ('Cavalier King Charles Spaniel', 19),
  ('Shih Tzu', 20), ('Bernese Mountain Dog', 21), ('Pomeranian', 22),
  ('Boston Terrier', 23), ('Havanese', 24), ('Shetland Sheepdog', 25),
  ('Cocker Spaniel', 26), ('Border Collie', 27), ('Chihuahua', 28),
  ('Maltese', 29), ('Pug', 30), ('Vizsla', 31), ('Australian Cattle Dog', 32),
  ('Weimaraner', 33), ('Mastiff', 34), ('Newfoundland', 35),
  ('Basset Hound', 36), ('Rhodesian Ridgeback', 37), ('Shiba Inu', 38),
  ('Samoyed', 39), ('Old English Sheepdog', 40), ('Bichon Frise', 41),
  ('Whippet', 42), ('Akita', 43), ('Belgian Malinois', 44), ('Collie', 45),
  ('Bloodhound', 46), ('Bullmastiff', 47), ('St. Bernard', 48),
  ('Portuguese Water Dog', 49), ('Alaskan Malamute', 50), ('Greyhound', 51),
  ('Italian Greyhound', 52), ('Papillon', 53), ('Staffordshire Bull Terrier', 54),
  ('American Staffordshire Terrier', 55), ('Bull Terrier', 56),
  ('Dalmatian', 57), ('Pembroke Welsh Corgi', 58), ('Cardigan Welsh Corgi', 59),
  ('Brittany', 60), ('Chow Chow', 61), ('English Springer Spaniel', 62),
  ('Irish Setter', 63), ('English Setter', 64), ('Gordon Setter', 65),
  ('Nova Scotia Duck Tolling Retriever', 66), ('Chesapeake Bay Retriever', 67),
  ('Curly-Coated Retriever', 68), ('Flat-Coated Retriever', 69),
  ('Wirehaired Pointing Griffon', 70), ('German Wirehaired Pointer', 71),
  ('American Water Spaniel', 72), ('Boykin Spaniel', 73),
  ('Afghan Hound', 74), ('Borzoi', 75), ('Saluki', 76), ('Scottish Deerhound', 77),
  ('Irish Wolfhound', 78), ('Norwegian Elkhound', 79), ('Finnish Spitz', 80),
  ('Keeshond', 81), ('Schipperke', 82), ('Tibetan Spaniel', 83),
  ('Tibetan Terrier', 84), ('Tibetan Mastiff', 85), ('Lhasa Apso', 86),
  ('Lowchen', 87), ('Coton de Tulear', 88), ('Dandie Dinmont Terrier', 89),
  ('Bedlington Terrier', 90), ('Kerry Blue Terrier', 91),
  ('Soft Coated Wheaten Terrier', 92), ('Australian Terrier', 93),
  ('Silky Terrier', 94), ('Norwich Terrier', 95), ('Norfolk Terrier', 96),
  ('Cairn Terrier', 97), ('Border Terrier', 98), ('Irish Terrier', 99),
  ('Manchester Terrier', 100), ('Skye Terrier', 101),
  ('Miniature Bull Terrier', 102), ('Glen of Imaal Terrier', 103),
  ('Affenpinscher', 104), ('Brussels Griffon', 105), ('Toy Fox Terrier', 106),
  ('Japanese Chin', 107), ('Chinese Crested', 108), ('Xoloitzcuintli', 109),
  ('Anatolian Shepherd', 110), ('Komondor', 111), ('Kuvasz', 112),
  ('Briard', 113), ('Bouvier des Flandres', 114), ('Beauceron', 115),
  ('Belgian Tervuren', 116), ('Belgian Sheepdog', 117), ('Leonberger', 118),
  ('Tosa', 119), ('Mudi', 120), ('Pumi', 121),
  ('Catahoula Leopard Dog', 122), ('Carolina Dog', 123), ('Blue Lacy', 124),
  ('West Highland White Terrier', 125), ('Jack Russell Terrier', 126),
  ('Parson Russell Terrier', 127), ('Rat Terrier', 128),
  ('Treeing Walker Coonhound', 129), ('Black and Tan Coonhound', 130),
  ('Bluetick Coonhound', 131), ('Redbone Coonhound', 132),
  ('American Foxhound', 133), ('English Foxhound', 134),
  ('Norwegian Lundehund', 135), ('Entlebucher Mountain Dog', 136),
  ('Greater Swiss Mountain Dog', 137), ('Appenzeller Sennenhund', 138),
  ('Estrela Mountain Dog', 139), ('Thai Ridgeback', 140),
  ('Korean Jindo', 141), ('Karelian Bear Dog', 142),
  ('Plott', 143), ('American Hairless Terrier', 144),
  ('Canaan Dog', 145), ('Ibizan Hound', 146), ('Pharaoh Hound', 147),
  ('Sloughi', 148), ('Azawakh', 149)
) AS t(name, sort_order)
ON CONFLICT DO NOTHING;

-- Seed cat breeds
INSERT INTO pet_breeds (species, name, sort_order)
SELECT 'cat', name, sort_order FROM (VALUES
  ('Mixed', 0), ('Unknown', 1),
  ('Domestic Shorthair', 2), ('Domestic Longhair', 3),
  ('Maine Coon', 4), ('Persian', 5), ('Siamese', 6), ('Ragdoll', 7),
  ('Bengal', 8), ('British Shorthair', 9), ('American Shorthair', 10),
  ('Sphynx', 11), ('Scottish Fold', 12), ('Abyssinian', 13),
  ('Burmese', 14), ('Russian Blue', 15), ('Norwegian Forest Cat', 16),
  ('Siberian', 17), ('Oriental Shorthair', 18), ('Devon Rex', 19),
  ('Cornish Rex', 20), ('Selkirk Rex', 21), ('Exotic Shorthair', 22),
  ('Tonkinese', 23), ('Birman', 24), ('Turkish Angora', 25),
  ('Turkish Van', 26), ('Egyptian Mau', 27), ('Ocicat', 28),
  ('Singapura', 29), ('Bombay', 30), ('Burmilla', 31),
  ('Chartreux', 32), ('Havana Brown', 33), ('Korat', 34),
  ('LaPerm', 35), ('Manx', 36), ('Munchkin', 37), ('Nebelung', 38),
  ('Pixiebob', 39), ('Savannah', 40), ('Scottish Straight', 41),
  ('British Longhair', 42), ('Somali', 43), ('Snowshoe', 44),
  ('American Curl', 45), ('American Bobtail', 46), ('Japanese Bobtail', 47),
  ('Lykoi', 48), ('Peterbald', 49), ('Donskoy', 50),
  ('Australian Mist', 51), ('Ragamuffin', 52), ('Highlander', 53),
  ('Polydactyl', 54), ('Khao Manee', 55), ('Sokoke', 56)
) AS t(name, sort_order)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. pet_colors: add read policy, seed
-- ============================================================
DROP POLICY IF EXISTS "pet_colors_read" ON pet_colors;
CREATE POLICY "pet_colors_read" ON pet_colors FOR SELECT
  TO anon, authenticated USING (true);

GRANT SELECT ON pet_colors TO anon, authenticated;

INSERT INTO pet_colors (name, sort_order)
SELECT name, sort_order FROM (VALUES
  ('Black', 0), ('White', 1), ('Brown', 2), ('Tan', 3),
  ('Cream', 4), ('Golden', 5), ('Yellow', 6), ('Red', 7),
  ('Blue / Gray', 8), ('Silver', 9), ('Chocolate', 10),
  ('Liver', 11), ('Fawn', 12), ('Brindle', 13), ('Merle', 14),
  ('Tricolor', 15), ('Bicolor', 16), ('Piebald', 17), ('Spotted', 18),
  ('Tuxedo', 19), ('Calico', 20), ('Tortoiseshell', 21),
  ('Tabby', 22), ('Orange', 23), ('Apricot', 24), ('Buff', 25),
  ('Sable', 26), ('Seal', 27), ('Other', 28)
) AS t(name, sort_order)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. pet_conditions: add resolved_on column
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pet_conditions' AND column_name = 'resolved_on'
  ) THEN
    ALTER TABLE pet_conditions ADD COLUMN resolved_on date;
  END IF;
END $$;

-- ============================================================
-- 4. pet_diet: add updated_by column
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pet_diet' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE pet_diet ADD COLUMN updated_by uuid;
  END IF;
END $$;

-- ============================================================
-- 5. pet_photos table (gallery, up to 10 per pet)
-- ============================================================
CREATE TABLE IF NOT EXISTS pet_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_profile boolean NOT NULL DEFAULT false,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_photos_pet_id ON pet_photos(pet_id, sort_order);

ALTER TABLE pet_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp_select" ON pet_photos;
CREATE POLICY "pp_select" ON pet_photos FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pp_insert" ON pet_photos;
CREATE POLICY "pp_insert" ON pet_photos FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM pet_relationships r
    WHERE r.pet_id = pet_photos.pet_id AND r.user_id = auth.uid() AND r.ended_on IS NULL
  ) OR EXISTS (
    SELECT 1 FROM pets p JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
    WHERE p.id = pet_photos.pet_id AND sm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM pets p JOIN organization_members om ON om.organization_id = p.shelter_id
    WHERE p.id = pet_photos.pet_id AND om.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM pets p WHERE p.id = pet_photos.pet_id AND p.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "pp_update" ON pet_photos;
CREATE POLICY "pp_update" ON pet_photos FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pet_relationships r
    WHERE r.pet_id = pet_photos.pet_id AND r.user_id = auth.uid() AND r.ended_on IS NULL
  ) OR EXISTS (
    SELECT 1 FROM pets p JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
    WHERE p.id = pet_photos.pet_id AND sm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM pets p JOIN organization_members om ON om.organization_id = p.shelter_id
    WHERE p.id = pet_photos.pet_id AND om.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM pets p WHERE p.id = pet_photos.pet_id AND p.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM pet_relationships r
    WHERE r.pet_id = pet_photos.pet_id AND r.user_id = auth.uid() AND r.ended_on IS NULL
  ) OR EXISTS (
    SELECT 1 FROM pets p JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
    WHERE p.id = pet_photos.pet_id AND sm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM pets p JOIN organization_members om ON om.organization_id = p.shelter_id
    WHERE p.id = pet_photos.pet_id AND om.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM pets p WHERE p.id = pet_photos.pet_id AND p.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "pp_delete" ON pet_photos;
CREATE POLICY "pp_delete" ON pet_photos FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pet_relationships r
    WHERE r.pet_id = pet_photos.pet_id AND r.user_id = auth.uid() AND r.ended_on IS NULL
  ) OR EXISTS (
    SELECT 1 FROM pets p JOIN shelter_members sm ON sm.shelter_id = p.shelter_id
    WHERE p.id = pet_photos.pet_id AND sm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM pets p JOIN organization_members om ON om.organization_id = p.shelter_id
    WHERE p.id = pet_photos.pet_id AND om.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM pets p WHERE p.id = pet_photos.pet_id AND p.owner_id = auth.uid()
  ));

GRANT SELECT ON pet_photos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON pet_photos TO authenticated;

-- ============================================================
-- 6. profiles: add weight_unit
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'weight_unit'
  ) THEN
    ALTER TABLE profiles ADD COLUMN weight_unit text NOT NULL DEFAULT 'lb' CHECK (weight_unit IN ('kg', 'lb'));
  END IF;
END $$;

-- ============================================================
-- 7. pet_documents: add kind CHECK constraint for new imaging types
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pet_documents_kind_check'
  ) THEN
    ALTER TABLE pet_documents ADD CONSTRAINT pet_documents_kind_check
      CHECK (kind IN ('vaccination', 'medical', 'xray', 'ultrasound', 'lab_result', 'imaging_other', 'other'));
  END IF;
END $$;