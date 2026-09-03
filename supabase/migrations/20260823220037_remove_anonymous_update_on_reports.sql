/*
  # Remove anonymous update access from reports

  1. Security
    - Drop the `anon_update_reports` policy, which allowed any anon or
      authenticated caller to modify any report row
      (`USING (true) WITH CHECK (true)`).
    - Revoke the UPDATE table privilege from `anon` and `authenticated`.

  2. Notes
    - Reports remain publicly readable (non-contact columns) and publicly
      insertable, which is the intended community map behaviour.
    - No screen in the application updates a report.
*/

DROP POLICY IF EXISTS "anon_update_reports" ON public.reports;

REVOKE UPDATE ON public.reports FROM anon;
REVOKE UPDATE ON public.reports FROM authenticated;
