/*
  # Remove anonymous delete access from reports

  1. Security
    - Drop the `anon_delete_reports` policy, which allowed any anon or
      authenticated caller to delete any report (`USING (true)`).
    - Revoke the DELETE table privilege from `anon` and `authenticated`.

  2. Notes
    - The `reports` table has no owner column, so ownership cannot be scoped.
    - No screen in the application deletes a report, so removing the
      capability does not change any user-facing behaviour.
*/

DROP POLICY IF EXISTS "anon_delete_reports" ON public.reports;

REVOKE DELETE ON public.reports FROM anon;
REVOKE DELETE ON public.reports FROM authenticated;
