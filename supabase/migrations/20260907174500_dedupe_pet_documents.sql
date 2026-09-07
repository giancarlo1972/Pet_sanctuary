DELETE FROM pet_documents a
USING pet_documents b
WHERE a.pet_id = b.pet_id
  AND coalesce(nullif(a.file_path, ''), a.storage_path, '') = coalesce(nullif(b.file_path, ''), b.storage_path, '')
  AND coalesce(nullif(a.file_path, ''), a.storage_path, '') <> ''
  AND a.created_at < b.created_at;
