-- Gina with-you-since + BCS, Aurora document kinds.
-- Paste once. Idempotent (same values on re-run).

-- Gina (97d675b6-9bf4-42cf-bcec-cbaa556c3748)
UPDATE public.pet_relationships
SET started_on = '2022-06-15'
WHERE pet_id = '97d675b6-9bf4-42cf-bcec-cbaa556c3748'
  AND relationship IN ('owner', 'own');

UPDATE public.pets
SET body_condition_score = 8
WHERE id = '97d675b6-9bf4-42cf-bcec-cbaa556c3748';

-- Lifestyle/Health read BCS from exam vitals first; keep those in sync.
UPDATE public.pet_exams
SET vitals = jsonb_set(coalesce(vitals, '{}'::jsonb), '{bcs}', '8'::jsonb)
WHERE pet_id = '97d675b6-9bf4-42cf-bcec-cbaa556c3748'
  AND vitals ? 'bcs';

-- Aurora (e1fc97c6-9a52-4b4f-8d7f-c4d37441d72e)
-- Strip catch-all imaging/insurance tags. Records tile counts exam_visit;
-- keep that on the original encounter summary only.
UPDATE public.pet_documents
SET content_kinds = ARRAY['labs', 'vaccinations']::text[]
WHERE pet_id = 'e1fc97c6-9a52-4b4f-8d7f-c4d37441d72e';

UPDATE public.pet_documents
SET content_kinds = ARRAY['exam_visit', 'labs', 'vaccinations']::text[]
WHERE pet_id = 'e1fc97c6-9a52-4b4f-8d7f-c4d37441d72e'
  AND title ILIKE 'Encounter Summary - Aurora Feline Wellness Visit';
