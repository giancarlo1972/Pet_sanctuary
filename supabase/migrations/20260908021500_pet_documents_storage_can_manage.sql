-- pet-documents: first path segment is pet_id (or legacy user_id).
-- Upload allowed for owner / co_owner / platform admin via can_manage_pet.

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

DROP POLICY IF EXISTS "pet_documents_read_own" ON storage.objects;
DROP POLICY IF EXISTS "pet_documents_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "pet_documents_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "pet_documents_update_own" ON storage.objects;
DROP POLICY IF EXISTS pet_documents_read ON storage.objects;
DROP POLICY IF EXISTS pet_documents_insert ON storage.objects;
DROP POLICY IF EXISTS pet_documents_update ON storage.objects;
DROP POLICY IF EXISTS pet_documents_delete ON storage.objects;

CREATE POLICY pet_documents_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pet-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_manage_pet(public.storage_folder_uuid(name))
      OR public.can_read_pet_medical(public.storage_folder_uuid(name))
    )
  );

CREATE POLICY pet_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pet-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_manage_pet(public.storage_folder_uuid(name))
    )
  );

CREATE POLICY pet_documents_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pet-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_manage_pet(public.storage_folder_uuid(name))
    )
  )
  WITH CHECK (
    bucket_id = 'pet-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_manage_pet(public.storage_folder_uuid(name))
    )
  );

CREATE POLICY pet_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'pet-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_manage_pet(public.storage_folder_uuid(name))
    )
  );
