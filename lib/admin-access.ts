/** profiles.role is only platform_admin | member. Org admin is membership. */

const PLATFORM_ROLES = new Set(['platform_admin', 'admin', 'application_admin', 'app_admin', 'devops', 'devops_admin', 'owner', 'superadmin', 'administrator']);

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
  return Boolean(e && EMAIL_OK.has(e));
}

/** @deprecated org admin is derived from organization_members, not profiles.role */
export function isOrgAdminRole(_role?: string | null) {
  return false;
}

export const SHARE_LEVELS = [
  { key: 'co_owner', label: 'Co-owner', hint: 'Full edit of this pet' },
  { key: 'caretaker', label: 'Caretaker', hint: 'Read + weight, feeding, notes' },
  { key: 'veterinarian', label: 'Veterinarian', hint: 'Read + write clinical records' },
] as const;

export type ShareLevel = (typeof SHARE_LEVELS)[number]['key'];
