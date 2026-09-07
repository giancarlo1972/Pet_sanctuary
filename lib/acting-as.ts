export type ActingRole = 'platform_admin' | 'org_admin' | 'pet_admin' | 'member';

export type ActingAs = {
  role: ActingRole;
  orgId?: string | null;
  orgName?: string | null;
};

export type HeldRole = ActingAs & { key: string; label: string };

const KEY = 'ra_acting_as';

const mem = new Map<string, string>();

async function store() {
  if (typeof localStorage !== 'undefined') {
    return {
      getItem: async (k: string) => localStorage.getItem(k),
      setItem: async (k: string, v: string) => { localStorage.setItem(k, v); },
      removeItem: async (k: string) => { localStorage.removeItem(k); },
    };
  }
  return {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => { mem.set(k, v); },
    removeItem: async (k: string) => { mem.delete(k); },
  };
}

export async function loadActingAs(): Promise<ActingAs | null> {
  try {
    const s = await store();
    const raw = await s.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || !v.role) return null;
    return { role: v.role, orgId: v.orgId || null, orgName: v.orgName || null };
  } catch {
    return null;
  }
}

export async function saveActingAs(v: ActingAs | null) {
  const s = await store();
  if (!v) await s.removeItem(KEY);
  else await s.setItem(KEY, JSON.stringify(v));
}

export function actingLabel(a: ActingAs | null, fallback = 'Member') {
  if (!a) return fallback;
  if (a.role === 'platform_admin') return 'Rescue Army admin';
  if (a.role === 'org_admin') return a.orgName ? `Org admin · ${a.orgName}` : 'Org admin';
  if (a.role === 'pet_admin') return 'Pet admin';
  return 'Member';
}

export function isReduced(a: ActingAs | null, home: ActingRole) {
  if (!a) return false;
  if (a.role !== home) return true;
  return false;
}
