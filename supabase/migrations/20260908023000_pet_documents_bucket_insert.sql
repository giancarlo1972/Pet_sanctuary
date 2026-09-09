-- Ensure private pet-documents bucket + owner INSERT via can_manage_pet(first folder uuid).

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('pet-documents', 'pet-documents', false, 33554432)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = COALESCE(storage.buckets.file_size_limit, 33554432);

CREATE OR REPLACE FUNCTION public.storage_folder_uuid(object_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  folder text;
BEGIN
  folder := (storage.foldername(object_name))[1];
  IF folder IS NULL OR folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN folder::uuid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.storage_folder_uuid(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_folder_uuid(text) TO authenticated, postgres;

-- Recreate INSERT so members who own the pet can write {pet_id}/file.
DROP POLICY IF EXISTS "pet_documents_insert_own" ON storage.objects;
DROP POLICY IF EXISTS pet_documents_insert ON storage.objects;

CREATE POLICY pet_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pet-documents'
    AND public.can_manage_pet(public.storage_folder_uuid(name))
  );

-- Table row insert (storage success is not enough if this policy is missing).
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS uploaded_by uuid;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS ai_status text;

DROP POLICY IF EXISTS pd_insert_manage ON pet_documents;
CREATE POLICY pd_insert_manage ON pet_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_pet(pet_id));
