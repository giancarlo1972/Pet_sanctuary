-- Break pets ↔ pet_relationships RLS recursion.
-- Invoker policies on pets must not SELECT pet_relationships, and
-- invoker policies on pet_relationships must not SELECT pets.
-- Helpers are SECURITY DEFINER so they bypass RLS on the other table.
-- Paste once in the Supabase SQL editor. Idempotent.

CREATE OR REPLACE FUNCTION public.has_pet_relationship(pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    pid IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pet_relationships pr
      WHERE pr.pet_id = pid
        AND pr.user_id = auth.uid()
        AND pr.ended_on IS NULL
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.has_pet_relationship(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_pet_relationship(uuid) TO authenticated;

-- pet_rel_level already SECURITY DEFINER; keep it from being inlined into
-- invoker policies that would re-enter pets RLS.

DROP POLICY IF EXISTS pets_rel_select ON public.pets;
DROP POLICY IF EXISTS pets_private_owner ON public.pets;
DROP POLICY IF EXISTS pets_public_adoptable ON public.pets;

CREATE POLICY pets_public_adoptable ON public.pets
  FOR SELECT TO anon, authenticated
  USING (listing_type = 'adoptable' AND COALESCE(is_public, true));

CREATE POLICY pets_private_owner ON public.pets
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_pet_relationship(id)
    OR (
      shelter_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = pets.shelter_id
          AND om.user_id = auth.uid()
      )
    )
    OR public.is_platform_admin()
  );

-- pet_relationships: own rows only on SELECT. Writes go through definer helpers
-- (can_manage_pet / accept_pet_share) so they never SELECT pets as invoker.
DROP POLICY IF EXISTS pr_owner_share ON public.pet_relationships;
DROP POLICY IF EXISTS pr_select_own ON public.pet_relationships;
DROP POLICY IF EXISTS pr_insert_own ON public.pet_relationships;
DROP POLICY IF EXISTS pr_update_own ON public.pet_relationships;
DROP POLICY IF EXISTS pr_delete_own ON public.pet_relationships;

CREATE POLICY pr_select_own ON public.pet_relationships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY pr_insert_own ON public.pet_relationships
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.can_manage_pet(pet_id)
  );

CREATE POLICY pr_update_own ON public.pet_relationships
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_pet(pet_id) OR public.is_platform_admin())
  WITH CHECK (user_id = auth.uid() OR public.can_manage_pet(pet_id) OR public.is_platform_admin());

CREATE POLICY pr_delete_own ON public.pet_relationships
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.can_manage_pet(pet_id) OR public.is_platform_admin());
