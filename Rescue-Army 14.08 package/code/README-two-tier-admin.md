# Two-tier admin — implementation notes

## Files
- `sql/two_tier_admin.sql` → run in Supabase SQL Editor (idempotent). Creates `is_platform_admin()`, `is_org_admin(org)`, one-admin-per-org index, `organization_invites`, `audit_log`, and RLS so org admins only touch their own org.
- `code/org-admin.tsx` → copy to `app/org-admin.tsx`.

## Wiring (3 edits)
1. **profile.tsx (Me):** after login everyone lands on Home. In Me, show buttons by role:
   - `isPlatformAdmin(role,email)` → navy "Open admin console" → `router.navigate('/admin')`
   - user has `organization_members.role='admin'` → teal "Manage {org.name}" → `router.navigate('/org-admin')`
2. **auth.tsx / AuthForm.tsx:** remove the `/admin` redirect + first-admin auto-promotion; `router.replace('/(tabs)')` (web: `window.location.assign('/')`). OAuth `redirectTo` → origin `/`. Update Supabase Auth URL config to match.
3. **admin.tsx (platform):** add "Organizations · all entities" section: list every org with `organization_members` admin, and an "Assign admin" action = upsert `{organization_id, user_id, role:'admin'}` (unique index guarantees one admin). Log to `audit_log`.

## Roles
- Platform admin: `profiles.role = 'admin'` — set only via SQL / another platform admin, never in login code.
- Org admin: `organization_members.role = 'admin'` — one per org, assigned by platform admin.
- Org members: `staff | volunteer | foster_coordinator` — managed by that org's admin.
