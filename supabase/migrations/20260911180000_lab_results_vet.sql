-- Persist clinic + vet on each lab row so Confirm/apply can keep
-- BondVet panels apart from At Home / Leshanski. Additive.
-- Paste once. Idempotent.

ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS clinic text;

ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS vet text;

COMMENT ON COLUMN public.lab_results.clinic IS 'Practice that ordered/collected this result (from Service on of the same date or IDEXX header).';
COMMENT ON COLUMN public.lab_results.vet IS 'Veterinarian from that same visit/header tuple — never mixed across clinics.';
