/*
# Pet record enhancements: vaccination INSERT policy, pet-documents storage policies, my_pet_reminders view

## Changes
1. Add INSERT/UPDATE policy on pet_vaccinations (currently SELECT-only)
2. Add storage policies for the private 'pet-documents' bucket (owner-scoped read/write)
3. Replace my_pet_reminders view with enriched version (pet_photo, days_until_due, urgency)
*/

-- ============================================================
-- 1. pet_vaccinations INSERT + UPDATE
-- ============================================================
DROP POLICY IF EXISTS "pv_insert_own" ON pet_vaccinations;
CREATE POLICY "pv_insert_own" ON pet_vaccinations FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM pet_relationships r
    WHERE r.pet_id = pet_vaccinations.pet_id
      AND r.user_id = auth.uid()
      AND r.ended_on IS NULL
  ));

DROP POLICY IF EXISTS "pv_update_own" ON pet_vaccinations;
CREATE POLICY "pv_update_own" ON pet_vaccinations FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pet_relationships r
    WHERE r.pet_id = pet_vaccinations.pet_id
      AND r.user_id = auth.uid()
      AND r.ended_on IS NULL
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM pet_relationships r
    WHERE r.pet_id = pet_vaccinations.pet_id
      AND r.user_id = auth.uid()
      AND r.ended_on IS NULL
  ));

-- ============================================================
-- 2. pet-documents storage policies (private bucket, owner-scoped)
--    Files stored under pet-documents/<user_id>/<filename>
-- ============================================================
DROP POLICY IF EXISTS "pet_documents_read_own" ON storage.objects;
CREATE POLICY "pet_documents_read_own" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'pet-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "pet_documents_insert_own" ON storage.objects;
CREATE POLICY "pet_documents_insert_own" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'pet-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "pet_documents_delete_own" ON storage.objects;
CREATE POLICY "pet_documents_delete_own" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'pet-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 3. Replace my_pet_reminders view with enriched version
-- ============================================================
DROP VIEW IF EXISTS my_pet_reminders;

CREATE VIEW my_pet_reminders AS
SELECT
  p.id AS pet_id,
  p.name AS pet_name,
  p.main_photo_url AS pet_photo,
  'vaccination' AS item_type,
  v.vaccine AS label,
  v.next_due_on AS due_on,
  (v.next_due_on - CURRENT_DATE) AS days_until_due,
  CASE
    WHEN v.next_due_on < CURRENT_DATE THEN 'overdue'
    WHEN v.next_due_on <= CURRENT_DATE + INTERVAL '30 days' THEN 'due_soon'
    ELSE 'upcoming'
  END AS urgency
FROM pet_vaccinations v
JOIN pets p ON p.id = v.pet_id
JOIN pet_relationships r ON r.pet_id = p.id AND r.user_id = auth.uid() AND r.ended_on IS NULL
WHERE v.next_due_on IS NOT NULL
UNION ALL
SELECT
  p.id AS pet_id,
  p.name AS pet_name,
  p.main_photo_url AS pet_photo,
  'care' AS item_type,
  COALESCE(c.title, c.event_type) AS label,
  c.next_due_on AS due_on,
  (c.next_due_on - CURRENT_DATE) AS days_until_due,
  CASE
    WHEN c.next_due_on < CURRENT_DATE THEN 'overdue'
    WHEN c.next_due_on <= CURRENT_DATE + INTERVAL '30 days' THEN 'due_soon'
    ELSE 'upcoming'
  END AS urgency
FROM pet_care_events c
JOIN pets p ON p.id = c.pet_id
JOIN pet_relationships r ON r.pet_id = p.id AND r.user_id = auth.uid() AND r.ended_on IS NULL
WHERE c.next_due_on IS NOT NULL;

GRANT SELECT ON my_pet_reminders TO authenticated;
