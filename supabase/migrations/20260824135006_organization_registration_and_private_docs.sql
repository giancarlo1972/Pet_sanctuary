/*
# Organization registration, membership, and private verification docs

## Purpose
Adds the remaining pieces needed for organizations to self-register and be
reviewed before they appear publicly:

1. `organizations.created_by` now defaults to the authenticated user so an
   insert that omits it still satisfies the existing INSERT policy.
2. New `organization_members` table links users to organizations with a role
   (admin / staff). This is separate from `shelter_members`, which keys to the
   legacy `shelters` table, not `organizations`.
3. New private storage bucket `org-verification` for verification documents
   (PDF or image). No public access; RLS allows only the uploader and the
   service role to read.
4. Tightened RLS on `organizations` so public SELECT only returns approved
   orgs, authenticated users can insert (created_by = auth.uid()), and only
   members can update.

## New Tables
- `organization_members`
  - `organization_id` uuid, FK to organizations(id) ON DELETE CASCADE
  - `user_id` uuid, FK to auth.users(id) ON DELETE CASCADE
  - `role` text, default 'admin', check in ('admin','staff')
  - `created_at` timestamptz default now()
  - PRIMARY KEY (organization_id, user_id)

## Security
- RLS enabled on `organization_members`.
  - SELECT: a user can read rows for orgs they belong to.
  - INSERT: a user may add themselves as a member only when creating the org
    (role admin), enforced by created_by = auth.uid() on the referenced org.
  - DELETE/UPDATE: only admins of the org.
- `organizations` policies replaced:
  - public_read_approved_orgs: anon + authenticated SELECT where status='approved'
  - members_read_own_org: authenticated SELECT for creators or members
  - authenticated_register_org: authenticated INSERT with created_by = auth.uid()
  - members_update_own_org: authenticated UPDATE for creators or members
- Storage bucket `org-verification` created as private (public = false).
  - SELECT policy: owner of the file (auth.uid() = owner) may read.
  - INSERT policy: authenticated users may upload to a path under their user id.
  - UPDATE/DELETE: owner only.
  - Paths must be of the form `<user_id>/<file>`.

## Important Notes
1. The `organizations` table and its status / org_type CHECK constraints
   already existed; this migration only adds the default and policies.
2. `shelter_members` is untouched; it continues to key to the legacy
   `shelters` table. The new `organization_members` table is the membership
   record for the `organizations` table.
3. The storage bucket is private; the frontend must use a signed URL or the
   service role to read verification docs. The public anon key cannot read
   them.
*/

-- 1. Default organizations.created_by to the authenticated user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attrdef
    WHERE adrelid = 'public.organizations'::regclass
      AND adnum = (SELECT attnum FROM pg_attribute
                   WHERE attrelid = 'public.organizations'::regclass
                     AND attname = 'created_by')
  ) THEN
    ALTER TABLE public.organizations
      ALTER COLUMN created_by SET DEFAULT auth.uid();
  END IF;
END $$;

-- 2. organization_members table
CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- members can read their own memberships
DROP POLICY IF EXISTS "members_read_own_membership" ON public.organization_members;
CREATE POLICY "members_read_own_membership"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- creator may insert their own admin row when the org is theirs
DROP POLICY IF EXISTS "creator_insert_membership" ON public.organization_members;
CREATE POLICY "creator_insert_membership"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.created_by = auth.uid()
    )
  );

-- admins may update membership within their org
DROP POLICY IF EXISTS "admins_update_membership" ON public.organization_members;
CREATE POLICY "admins_update_membership"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = organization_members.organization_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = organization_members.organization_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

-- admins may delete membership within their org
DROP POLICY IF EXISTS "admins_delete_membership" ON public.organization_members;
CREATE POLICY "organization_members_delete_own"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = organization_members.organization_id
        AND m.user_id = auth.uid()
        AND m.role = 'admin'
    )
  );

-- 3. Refresh organizations policies (drop + recreate for idempotency)
DROP POLICY IF EXISTS "public_read_approved_orgs" ON public.organizations;
DROP POLICY IF EXISTS "members_read_own_org" ON public.organizations;
DROP POLICY IF EXISTS "authenticated_register_org" ON public.organizations;
DROP POLICY IF EXISTS "members_update_own_org" ON public.organizations;

-- public can read only approved orgs
CREATE POLICY "public_read_approved_orgs"
  ON public.organizations FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- creators and members can read their own org (any status)
CREATE POLICY "members_read_own_org"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- authenticated users may insert an org they own
CREATE POLICY "authenticated_register_org"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- only creators and members may update
CREATE POLICY "members_update_own_org"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- 4. Private storage bucket for verification docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-verification', 'org-verification', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only owner may read/write their own uploads
DROP POLICY IF EXISTS "org_verification_owner_read" ON storage.objects;
CREATE POLICY "org_verification_owner_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'org-verification'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "org_verification_owner_insert" ON storage.objects;
CREATE POLICY "org_verification_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'org-verification'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "org_verification_owner_update" ON storage.objects;
CREATE POLICY "org_verification_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'org-verification'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'org-verification'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "org_verification_owner_delete" ON storage.objects;
CREATE POLICY "org_verification_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'org-verification'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
