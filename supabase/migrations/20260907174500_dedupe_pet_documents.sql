DELETE FROM pet_documents a
USING pet_documents b
WHERE a.pet_id = b.pet_id
  AND a.file_path IS NOT NULL
  AND a.file_path <> ''
  AND a.file_path = b.file_path
  AND a.created_at < b.created_at;
