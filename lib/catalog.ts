export type CatalogKind = 'vaccine' | 'analyte' | 'condition' | 'medication' | 'clinic';

export type CatalogRow = {
  id: string;
  name: string;
  aliases?: string[] | null;
  manufacturer?: string | null;
  duration_years?: number | null;
  route?: string | null;
  species?: string | null;
  unit?: string | null;
  ref_low?: number | null;
  ref_high?: number | null;
  category?: string | null;
  common_dose?: string | null;
};

export type MatchResult = {
  row: CatalogRow | null;
  confidence: 'high' | 'med' | 'low' | 'none';
  custom: boolean;
};

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function matchCatalog(query: string | null | undefined, rows: CatalogRow[]): MatchResult {
  const q = norm(query || '');
  if (!q || !rows.length) return { row: null, confidence: 'none', custom: true };
  for (const r of rows) {
    const names = [r.name, ...(r.aliases || [])].map(norm);
    if (names.includes(q)) return { row: r, confidence: 'high', custom: false };
  }
  for (const r of rows) {
    const names = [r.name, ...(r.aliases || [])].map(norm);
    if (names.some((n) => n && (q.includes(n) || n.includes(q)))) return { row: r, confidence: 'med', custom: false };
  }
  const tokens = q.split(' ').filter((t) => t.length > 2);
  if (tokens.length) {
    const hit = rows.find((r) => tokens.some((t) => norm(r.name).includes(t)));
    if (hit) return { row: hit, confidence: 'low', custom: false };
  }
  return { row: null, confidence: 'none', custom: true };
}

export function vaccineType(name: string | null | undefined): string {
  const q = norm(name || '');
  if (!q) return 'Other';
  const types: [string, string[]][] = [
    ['FVRCP', ['fvrcp', 'fvrccp', 'feline distemper', 'rhinotracheitis', 'calici', 'panleukopenia']],
    ['Rabies', ['rabies', 'purevax rabies']],
    ['FeLV', ['felv', 'leukemia', 'feline leukemia']],
    ['DHPP', ['dhpp', 'da2pp', 'distemper parvovirus']],
    ['Bordetella', ['bordetella', 'kennel cough']],
    ['Leptospirosis', ['lepto', 'leptospirosis']],
    ['Lyme', ['lyme', 'borrelia']],
    ['Influenza', ['influenza', 'civ', ' canine flu']],
  ];
  for (const [type, aliases] of types) {
    if (aliases.some((a) => q.includes(a))) return type;
  }
  return name || 'Other';
}
