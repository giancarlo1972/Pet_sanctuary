-- Private identity-docs bucket + ID submission columns.
-- Run in Supabase SQL Editor.

INSERT INTO storage.buckets (id, name, public)
VALUES ('identity-docs', 'identity-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS identity_docs_own_insert ON storage.objects;
CREATE POLICY identity_docs_own_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'identity-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS identity_docs_own_update ON storage.objects;
CREATE POLICY identity_docs_own_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'identity-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS identity_docs_read ON storage.objects;
CREATE POLICY identity_docs_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'identity-docs'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_platform_admin()
    )
  );

ALTER TABLE user_verifications ADD COLUMN IF NOT EXISTS id_status text NOT NULL DEFAULT 'none';
ALTER TABLE user_verifications ADD COLUMN IF NOT EXISTS id_document_path text;
ALTER TABLE user_verifications ADD COLUMN IF NOT EXISTS phone text;

-- submitted IDs appear in Platform → Approvals
DROP POLICY IF EXISTS uv_platform ON user_verifications;
CREATE POLICY uv_platform ON user_verifications FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS mq_insert_own ON moderation_queue;
CREATE POLICY mq_insert_own ON moderation_queue FOR INSERT TO authenticated
  WITH CHECK (true);
