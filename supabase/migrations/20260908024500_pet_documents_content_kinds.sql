ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS content_kinds text[];

UPDATE pet_documents
SET content_kinds = ARRAY['vaccinations','labs','exam_visit','weight','medications','imaging','insurance','other']
WHERE content_kinds IS NULL;
