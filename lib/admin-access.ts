/** Rescue Army platform masters — /admin only. Not org staff. */
const PLATFORM_ROLES = new Set([
  'platform_admin',
  'application_admin',
  'app_admin',
  'devops',
  'devops_admin',
  'owner',
  'superadmin',
  'administrator',
]);

/** Shelter/org staff — /org-admin only, scoped to their org. */
const ORG_ROLES = new Set(['org_admin', 'shelter']);

const EMAIL_OK = new Set(
  [
    'giancarlo.leins@gmail.com',
    'giancarlo.pereira@gmail.com',
    'giancarlo.pereira@ruuma.net',
    'giancarlo.pereira@rescue-army.com',
    'support@ruuma.net',
    'support.animals@rescue-army.com',
    'admin@rescue-army.com',
    ...(typeof process !== 'undefined' && process.env.EXPO_PUBLIC_ADMIN_EMAILS
      ? process.env.EXPO_PUBLIC_ADMIN_EMAILS.split(',')
      : []),
  ].map((s) => s.trim().toLowerCase()).filter(Boolean)
);

export function isPlatformAdmin(role?: string | null, email?: string | null) {
  const r = (role || '').toLowerCase().trim();
  if (PLATFORM_ROLES.has(r)) return true;
  const e = (email || '').toLowerCase().trim();
  if (e && EMAIL_OK.has(e)) return true;
  return false;
}

export function isOrgAdminRole(role?: string | null) {
  const r = (role || '').toLowerCase().trim();
  return ORG_ROLES.has(r);
}
