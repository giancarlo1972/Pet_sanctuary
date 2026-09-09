-- Documents upload for anyone the UI already lets tap Upload:
-- pet owner, co-owner, org/shelter staff (canEdit). Also keeps the
-- legacy first-folder = auth.uid() storage path so uploads work if
-- an older policy is still live.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('pet-documents', 'pet-documents', false, 33554432)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = COALESCE(storage.buckets.file_size_limit, 33554432);

ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS uploaded_by uuid;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS file_path text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS clinic text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS taken_on date;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS ai_status text;
ALTER TABLE pet_documents ADD COLUMN IF NOT EXISTS content_kinds text[];

UPDATE pet_documents
SET content_kinds = ARRAY['vaccinations','labs','exam_visit','weight','medications','imaging','insurance','other']
WHERE content_kinds IS NULL;

CREATE OR REPLACE FUNCTION public.storage_folder_uuid(object_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  folder text;
BEGIN
  folder := (storage.foldername(object_name))[1];
  IF folder IS NULL OR folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN folder::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_write_pet_document(pid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pid IS NULL OR auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM pets p WHERE p.id = pid AND p.owner_id = auth.uid()) THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pet_relationships pr
    WHERE pr.pet_id = pid
      AND pr.user_id = auth.uid()
      AND pr.ended_on IS NULL
      AND lower(pr.relationship) IN ('owner','own','co_owner','co-owner')
  ) THEN
    RETURN true;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pets p
    JOIN organization_members om
      ON om.organization_id = p.shelter_id AND om.user_id = auth.uid()
    WHERE p.id = pid
  ) THEN
    RETURN true;
  END IF;
  BEGIN
    IF EXISTS (
      SELECT 1 FROM pets p
      JOIN shelter_members sm
        ON sm.shelter_id = p.shelter_id AND sm.user_id = auth.uid()
      WHERE p.id = pid
    ) THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  BEGIN
    IF public.is_platform_admin() THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN undefined_function THEN
    NULL;
  END;
  RETURN false;
END;
$$;

-- Storage policies evaluate these; PUBLIC execute avoids "policy ran but
-- function not granted" denials that surface as RLS violations.
GRANT EXECUTE ON FUNCTION public.storage_folder_uuid(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_pet_document(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_folder_uuid(text) TO authenticated, postgres;
GRANT EXECUTE ON FUNCTION public.can_write_pet_document(uuid) TO authenticated, postgres;

DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION public.can_read_pet_medical(uuid) TO PUBLIC;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION public.storage_folder_uuid(text) TO service_role;
  GRANT EXECUTE ON FUNCTION public.can_write_pet_document(uuid) TO service_role;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

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
      OR public.can_write_pet_document(public.storage_folder_uuid(name))
      OR public.can_read_pet_medical(public.storage_folder_uuid(name))
    )
  );

CREATE POLICY pet_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pet-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_write_pet_document(public.storage_folder_uuid(name))
    )
  );

CREATE POLICY pet_documents_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pet-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_write_pet_document(public.storage_folder_uuid(name))
    )
  )
  WITH CHECK (
    bucket_id = 'pet-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_write_pet_document(public.storage_folder_uuid(name))
    )
  );

CREATE POLICY pet_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'pet-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_write_pet_document(public.storage_folder_uuid(name))
    )
  );

DROP POLICY IF EXISTS pd_insert ON pet_documents;
DROP POLICY IF EXISTS pd_insert_manage ON pet_documents;
DROP POLICY IF EXISTS pd_insert_write ON pet_documents;

CREATE POLICY pd_insert_write ON pet_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_pet_document(pet_id));

DROP POLICY IF EXISTS pd_update ON pet_documents;
DROP POLICY IF EXISTS pd_update_write ON pet_documents;
CREATE POLICY pd_update_write ON pet_documents
  FOR UPDATE TO authenticated
  USING (
    public.can_write_pet_document(pet_id)
    OR public.can_read_pet_medical(pet_id)
  )
  WITH CHECK (
    public.can_write_pet_document(pet_id)
    OR public.can_read_pet_medical(pet_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pet_documents TO authenticated;

CREATE OR REPLACE FUNCTION public.insert_pet_document(
  p_pet_id uuid,
  p_kind text,
  p_file_path text,
  p_title text DEFAULT NULL,
  p_taken_on date DEFAULT NULL,
  p_clinic text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_content_kinds text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec pet_documents%ROWTYPE;
  kinds text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  IF NOT public.can_write_pet_document(p_pet_id) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  kinds := COALESCE(p_content_kinds, ARRAY['vaccinations','labs','exam_visit','weight','medications','imaging','insurance','other']);
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pet_documents' AND column_name = 'content_kinds'
  ) THEN
    INSERT INTO pet_documents (
      pet_id, kind, file_path, storage_path, title, taken_on, clinic, notes,
      uploaded_by, created_by, ai_status, content_kinds
    ) VALUES (
      p_pet_id, COALESCE(p_kind, 'medical_record'), p_file_path, p_file_path,
      p_title, p_taken_on, p_clinic, p_notes,
      auth.uid(), auth.uid(), 'processing', kinds
    ) RETURNING * INTO rec;
  ELSE
    INSERT INTO pet_documents (
      pet_id, kind, file_path, storage_path, title, taken_on, clinic, notes,
      uploaded_by, created_by, ai_status
    ) VALUES (
      p_pet_id, COALESCE(p_kind, 'medical_record'), p_file_path, p_file_path,
      p_title, p_taken_on, p_clinic, p_notes,
      auth.uid(), auth.uid(), 'processing'
    ) RETURNING * INTO rec;
  END IF;
  RETURN to_jsonb(rec);
END;
$$;

REVOKE ALL ON FUNCTION public.insert_pet_document(uuid, text, text, text, date, text, text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_pet_document(uuid, text, text, text, date, text, text, text[]) TO authenticated;
