-- Lab PDFs were tagged insurance (title matched /insur/ or catch-all kinds).
-- Policy lives on insurance_policies; strip insurance from lab/exam docs.
-- Paste once. Idempotent.

UPDATE public.pet_documents
SET content_kinds = array_remove(coalesce(content_kinds, '{}'::text[]), 'insurance')
WHERE 'insurance' = ANY (coalesce(content_kinds, '{}'::text[]))
  AND (
    title ILIKE '%blood count%'
    OR title ILIKE '%CBC%'
    OR title ILIKE '%Hudson Animal Hospital%'
    OR kind IN ('lab_result')
    OR 'labs' = ANY (coalesce(content_kinds, '{}'::text[]))
  );
