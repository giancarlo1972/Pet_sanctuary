ALTER TABLE pet_conditions ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE pet_conditions ADD COLUMN IF NOT EXISTS onset_date date;
ALTER TABLE pet_conditions ADD COLUMN IF NOT EXISTS resolved_date date;
ALTER TABLE pet_conditions ADD COLUMN IF NOT EXISTS source_document_id uuid;

UPDATE pet_conditions
SET status = CASE
  WHEN COALESCE(is_active, true) = false OR resolved_on IS NOT NULL THEN 'resolved'
  ELSE 'active'
END
WHERE status IS NULL;

UPDATE pet_conditions SET onset_date = diagnosed_on WHERE onset_date IS NULL AND diagnosed_on IS NOT NULL;
UPDATE pet_conditions SET resolved_date = resolved_on WHERE resolved_date IS NULL AND resolved_on IS NOT NULL;

-- Keep the newest row per pet + lower(name); drop duplicates (Gina's 10 copies).
DELETE FROM pet_conditions a
USING pet_conditions b
WHERE a.pet_id = b.pet_id
  AND lower(trim(a.name)) = lower(trim(b.name))
  AND a.id <> b.id
  AND a.created_at IS NOT NULL
  AND b.created_at IS NOT NULL
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

-- Fallback if created_at missing
DELETE FROM pet_conditions a
USING pet_conditions b
WHERE a.pet_id = b.pet_id
  AND lower(trim(a.name)) = lower(trim(b.name))
  AND a.id < b.id;
