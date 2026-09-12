-- Identity field provenance so owner-entered DOB / sex / spayed always win.
-- Extraction writes only when the current value is null or source != 'owner'.
-- age_years is derived at read time and is never a column.
-- Paste once. Idempotent.

ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS date_of_birth_source text,
  ADD COLUMN IF NOT EXISTS gender_source text,
  ADD COLUMN IF NOT EXISTS spayed_neutered_source text;

COMMENT ON COLUMN public.pets.date_of_birth_source IS
  'owner | ai_extracted | clinic. Owner-entered always wins; extraction writes only if null or source != owner.';
COMMENT ON COLUMN public.pets.gender_source IS
  'owner | ai_extracted | clinic. Owner-entered always wins.';
COMMENT ON COLUMN public.pets.spayed_neutered_source IS
  'owner | ai_extracted | clinic. Owner-entered always wins.';

GRANT SELECT (date_of_birth_source, gender_source, spayed_neutered_source) ON public.pets TO authenticated;
GRANT UPDATE (date_of_birth_source, gender_source, spayed_neutered_source) ON public.pets TO authenticated;
