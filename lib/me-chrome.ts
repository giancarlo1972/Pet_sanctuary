export type MeVisualRole = 'owner' | 'provider' | 'organization' | 'platform';

export const ME_ROLE_COLOR: Record<MeVisualRole, string> = {
  owner: '#E85A50',
  provider: '#2E9E96',
  organization: '#26265E',
  platform: '#26265E',
};

export const ME_ROLE_LABEL: Record<MeVisualRole, string> = {
  owner: 'Owner',
  provider: 'Provider',
  organization: 'Org',
  platform: 'Platform',
};

const VIEW_KEY = 'ra_me_view';

export function initialsFromName(name?: string | null, email?: string | null): string {
  const n = String(name || '').trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const em = String(email || '').trim();
  if (em) {
    const local = em.split('@')[0] || '';
    const bits = local.split(/[._-]/).filter(Boolean);
    if (bits.length >= 2) return (bits[0][0] + bits[1][0]).toUpperCase();
    return local.slice(0, 2).toUpperCase() || 'ME';
  }
  return 'ME';
}

export function loadMeView(): MeVisualRole {
  try {
    if (typeof localStorage === 'undefined') return 'owner';
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'owner' || v === 'provider' || v === 'organization' || v === 'platform') return v;
  } catch { /* ignore */ }
  return 'owner';
}

export function saveMeView(v: MeVisualRole) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(VIEW_KEY, v);
  } catch { /* ignore */ }
}
