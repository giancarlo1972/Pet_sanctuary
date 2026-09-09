const DROP = new Set([
  'dvm', 'vmd', 'dacvim', 'dacvo', 'dacvp', 'dacvs', 'dacvd',
  'dr', 'doctor', 'phd', 'ms', 'mr', 'mrs',
  'vet', 'vets', 'veterinary', 'veterinarian',
  'hospital', 'clinic', 'clinics',
  'pc', 'llc', 'inc', 'pa', 'pllc', 'dba',
]);

export function normalizeClinicName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !DROP.has(w))
    .join(' ')
    .trim();
}

export function clinicKeysMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length < 5) return false;
  return long.startsWith(short + ' ') || long === short;
}

export function pickCanonicalClinic(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!unique.length) return '';
  const noPerson = unique.filter((n) => !/\b(dvm|vmd|dr\.?)\b/i.test(n) && !/\s[-–—]\s+[A-Z]/.test(n));
  const pool = noPerson.length ? noPerson : unique;
  return pool.slice().sort((a, b) => b.length - a.length)[0];
}

export type ClinicCluster<T extends { name: string }> = T & { variants: string[] };

export function groupClinicEntries<T extends { name: string }>(rows: T[]): ClinicCluster<T>[] {
  const items = rows.filter((r) => String(r.name || '').trim());
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const unite = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pa] = pb;
  };
  const keys = items.map((r) => normalizeClinicName(r.name));
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (clinicKeysMatch(keys[i], keys[j])) unite(i, j);
    }
  }
  const groups = new Map<number, T[]>();
  items.forEach((row, i) => {
    const p = find(i);
    const g = groups.get(p) || [];
    g.push(row);
    groups.set(p, g);
  });
  return [...groups.values()].map((g) => {
    const variants = [...new Set(g.map((x) => x.name.trim()))];
    return { ...g[0], name: pickCanonicalClinic(variants), variants };
  });
}
