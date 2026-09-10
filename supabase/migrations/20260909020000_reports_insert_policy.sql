-- Paste in the production Supabase SQL editor. Required before reports can submit.
--
-- Production `anon_insert_reports` WITH CHECK used to read contact_name / contact_phone.
-- Those columns are not SELECTable by anon/authenticated (revoked for privacy),
-- so Postgres evaluates the check as NULL and every insert fails with RLS —
-- even when the app sends a phone number.
-- Phone is still required in the app and stored on insert; do not read it in RLS.
-- Signed-in rows must belong to the caller. Always pending_moderation on insert.

GRANT INSERT ON public.reports TO anon, authenticated;
GRANT INSERT (contact_name, contact_phone, contact_email, user_id, status, severity, report_type)
  ON public.reports TO anon, authenticated;

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reports' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.reports', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "anon_insert_reports"
  ON public.reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending_moderation'
    AND severity IN ('standard', 'urgent', 'critical')
    AND (
      (auth.uid() IS NULL AND user_id IS NULL)
      OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    )
  );
