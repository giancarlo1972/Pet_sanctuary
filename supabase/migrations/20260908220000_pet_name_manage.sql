-- Owner / co_owner / platform admin can update pet name + characteristics.
-- Run in Supabase SQL Editor. Idempotent.

GRANT UPDATE (
  name, breed, gender, date_of_birth, age_text,
  primary_color, secondary_color, color_notes,
  breed_primary, breed_secondary, is_mixed, breed_notes,
  coat, personality, spayed_neutered
) ON pets TO authenticated;

DROP POLICY IF EXISTS pets_manage_update ON pets;
CREATE POLICY pets_manage_update ON pets
  FOR UPDATE TO authenticated
  USING (public.can_manage_pet(id))
  WITH CHECK (public.can_manage_pet(id));
