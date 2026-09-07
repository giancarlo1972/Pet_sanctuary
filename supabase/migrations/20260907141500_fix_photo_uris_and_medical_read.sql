-- Null device/picker URIs that were stored as photo paths.
UPDATE pets
SET main_photo_url = NULL
WHERE main_photo_url IS NOT NULL
  AND (
    main_photo_url LIKE 'file:%'
    OR main_photo_url LIKE 'blob:%'
    OR main_photo_url LIKE 'content:%'
    OR main_photo_url LIKE 'data:%'
  );

DELETE FROM pet_photos
WHERE photo_url IS NOT NULL
  AND (
    photo_url LIKE 'file:%'
    OR photo_url LIKE 'blob:%'
    OR photo_url LIKE 'content:%'
    OR photo_url LIKE 'data:%'
  );

-- Owner, active relationship, org/shelter staff, or approved medical request.
CREATE OR REPLACE FUNCTION public.can_read_pet_medical(pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pets p WHERE p.id = pid AND (
      p.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM pet_relationships pr
        WHERE pr.pet_id = p.id AND pr.user_id = auth.uid() AND pr.ended_on IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.organization_id = p.shelter_id AND om.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM shelter_members sm
        WHERE sm.shelter_id = p.shelter_id AND sm.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM record_access_requests rar
        WHERE rar.pet_id = p.id AND rar.requester_id = auth.uid()
          AND rar.scope = 'medical' AND rar.status = 'approved'
      )
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_read_pet_medical(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_pet_medical(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_pet_medical(uuid) TO postgres;

-- Keep SELECT working for owners even if a stricter ALL policy exists.
DROP POLICY IF EXISTS pd_select ON pet_documents;
CREATE POLICY pd_select ON pet_documents
  FOR SELECT TO authenticated
  USING (can_read_pet_medical(pet_id));
