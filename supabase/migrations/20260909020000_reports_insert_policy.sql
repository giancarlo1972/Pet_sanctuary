-- Fix reports INSERT RLS.
-- Production `anon_insert_reports` WITH CHECK referenced contact_name / contact_phone.
-- Those columns are not SELECTable by anon/authenticated (revoked for privacy), so
-- Postgres evaluates the check as NULL and every insert fails with RLS.
-- Phone is still required in the app and stored on insert; do not read it in RLS.
-- Signed-in rows must belong to the caller. Always pending_moderation on insert.

GRANT INSERT ON reports TO anon, authenticated;
GRANT INSERT (contact_name, contact_phone, contact_email) ON reports TO anon, authenticated;

DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports"
  ON reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pending_moderation'
    AND severity IN ('standard', 'urgent', 'critical')
    AND (
      (auth.uid() IS NULL AND user_id IS NULL)
      OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    )
  );
