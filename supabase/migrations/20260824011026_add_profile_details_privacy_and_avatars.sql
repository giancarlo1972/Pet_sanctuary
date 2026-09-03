/*
# Profile details, column-level privacy, and avatars storage

This migration extends user profiles with contact, address, and social fields,
makes only the shareable fields visible to other users, and creates a storage
bucket for profile photos.

1. Modified Tables
  - `profiles` — new nullable text columns:
    - Private (owner only): `phone`, `address_street`, `address_city`,
      `address_state`, `address_zip`
    - Public (shareable): `facebook`, `instagram`, `x_handle`

2. Privacy model
  - The base `profiles` table keeps its existing owner-only row policy
    (`auth.uid() = id`), so a signed-in user can read ALL of their own fields,
    while other users get zero rows from the table directly. Row Level Security
    scopes rows, not columns, so the private fields can never be read by other
    users through the table.
  - A new `public_profiles` view exposes ONLY the shareable columns
    (`id`, `full_name`, `avatar_url`, `facebook`, `instagram`, `x_handle`) to
    everyone. It intentionally runs with the view owner's rights so these public
    fields are readable across users, but because it never selects phone or
    address columns, private data cannot leak through it.
  - Write access stays column-scoped via grants: users may update their own
    display name, location, avatar, contact, address, and social fields, but
    NOT their `role` or `email`.

3. Storage
  - New public bucket `avatars` for profile photos.
  - Anyone can read avatar images (public bucket). Only authenticated users can
    upload/update/delete files inside their own `{user_id}/...` folder.

4. Important notes
  1. All new columns are nullable so existing rows remain valid.
  2. The migration is safe to re-run (idempotent adds, grants, and policy drops).
*/

-- 1. New profile columns ------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='phone') THEN
    ALTER TABLE public.profiles ADD COLUMN phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='address_street') THEN
    ALTER TABLE public.profiles ADD COLUMN address_street text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='address_city') THEN
    ALTER TABLE public.profiles ADD COLUMN address_city text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='address_state') THEN
    ALTER TABLE public.profiles ADD COLUMN address_state text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='address_zip') THEN
    ALTER TABLE public.profiles ADD COLUMN address_zip text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='facebook') THEN
    ALTER TABLE public.profiles ADD COLUMN facebook text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='instagram') THEN
    ALTER TABLE public.profiles ADD COLUMN instagram text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='x_handle') THEN
    ALTER TABLE public.profiles ADD COLUMN x_handle text;
  END IF;
END $$;

-- 2. Column-scoped write access ----------------------------------------------
-- Users may edit these fields on their own row (the owner-only UPDATE policy
-- already restricts WHICH row). role and email remain non-updatable.
GRANT UPDATE (
  full_name, location, avatar_url,
  phone, address_street, address_city, address_state, address_zip,
  facebook, instagram, x_handle
) ON public.profiles TO authenticated;

-- 3. Public projection view (shareable columns only) --------------------------
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, full_name, avatar_url, facebook, instagram, x_handle
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 4. Avatars storage bucket + policies ---------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
