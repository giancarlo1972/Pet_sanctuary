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

function corpOwner(email: string) {
  return email.endsWith('@ruuma.net');
}

export function isPlatformAdmin(role?: string | null, email?: string | null) {
  if (role && ROLE_OK.has(role.toLowerCase().trim())) return true;
  const e = (email || '').toLowerCase().trim();
  if (e && (EMAIL_OK.has(e) || corpOwner(e))) return true;
  return false;
}
