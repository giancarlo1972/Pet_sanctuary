/*
# Privacy-safe contact flow: revoke contact_phone from clients, add direct contact opt-in

## Summary

This migration enforces a privacy-safe contact flow for reports:

1. **New column**: `reports.allow_direct_contact` (boolean, default false) — lets the reporter
   opt in at report time to allow verified responders to call them directly without a request.
2. **Revoke SELECT on contact_phone**: the `contact_phone` column is no longer readable by
   `anon` or `authenticated` roles. The phone number is only retrievable through the
   `get_report_contact(id)` RPC, which checks an approved `record_access_requests` row first
   and logs the access.
3. **RLS for report owners on record_access_requests**: the reporter (reports.user_id) can now
   SELECT and UPDATE access requests on their own reports, so they can approve/decline them.
   The existing org-staff policies remain in place.

## Columns added

- `reports.allow_direct_contact` — boolean, default false, nullable. When true, verified
  responders see a Call button without needing an access request.

## Security changes

- REVOKE SELECT (contact_phone) ON reports FROM anon, authenticated.
  The column is still INSERT-able (reporters provide their number at report time).
  The column is still REFERENCES-able for FK integrity.
- New RLS policies on `record_access_requests`:
  - `rar_select_report_owner` — SELECT: report owner (reports.user_id = auth.uid()) can see
    access requests on their reports.
  - `rar_update_report_owner` — UPDATE: report owner can approve/decline access requests
    on their reports (sets status, decided_at, decided_by, expires_at).

## Important notes

1. The `get_report_contact(p_report_id)` RPC already exists and checks for an approved
   access request before returning the phone. No change needed to that function.
2. The `log_record_access` function already exists and is called by `get_report_contact`.
3. After this migration, any client SELECT that includes `contact_phone` will return null
   for that column — the frontend must be updated to remove it from all SELECT queries
   and use the RPC instead.
*/

-- 1. Add allow_direct_contact column to reports
ALTER TABLE reports 
  ADD COLUMN IF NOT EXISTS allow_direct_contact boolean NOT NULL DEFAULT false;

-- 2. Revoke SELECT on contact_phone from client roles
--    The column remains INSERT-able (reporters provide their number) and REFERENCES-able.
--    SELECT is removed so the phone is never included in client query results.
REVOKE SELECT (contact_phone) ON reports FROM anon;
REVOKE SELECT (contact_phone) ON reports FROM authenticated;

-- 3. RLS: allow report owners to see and act on access requests for their reports
--    Existing policies (rar_select_own, rar_select_org, rar_update_org, rar_insert_own) remain.

DROP POLICY IF EXISTS "rar_select_report_owner" ON record_access_requests;
CREATE POLICY "rar_select_report_owner"
ON record_access_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM reports r
    WHERE r.id = record_access_requests.pet_id
    AND r.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "rar_update_report_owner" ON record_access_requests;
CREATE POLICY "rar_update_report_owner"
ON record_access_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM reports r
    WHERE r.id = record_access_requests.pet_id
    AND r.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM reports r
    WHERE r.id = record_access_requests.pet_id
    AND r.user_id = auth.uid()
  )
);
