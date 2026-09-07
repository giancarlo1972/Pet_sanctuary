const ROLE_OK = new Set([
  'admin', 'administrator', 'org_admin', 'application_admin', 'app_admin',
  'devops', 'devops_admin', 'owner', 'superadmin', 'shelter',
]);

const EMAIL_OK = new Set(
  [
    'giancarlo.pereira@gmail.com',
    'giancarlo.pereira@ruuma.net',
    'giancarlo.pereira@rescue-army.com',
    'support.animals@rescue-army.com',
    'admin@rescue-army.com',
    ...(typeof process !== 'undefined' && process.env.EXPO_PUBLIC_ADMIN_EMAILS
      ? process.env.EXPO_PUBLIC_ADMIN_EMAILS.split(',')
      : []),
  ].map((s) => s.trim().toLowerCase()).filter(Boolean)
);

export function isPlatformAdmin(role?: string | null, email?: string | null) {
  if (role && ROLE_OK.has(role.toLowerCase().trim())) return true;
  const e = (email || '').toLowerCase().trim();
  if (!e) return false;
  if (EMAIL_OK.has(e)) return true;
  if (e.endsWith('@ruuma.net') || e.endsWith('@rescue-army.com')) return true;
  if (e.includes('giancarlo.pereira')) return true;
  return false;
}
