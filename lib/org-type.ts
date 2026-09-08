/** Canonical org sections used by Community, org detail, and Nearby. */

export type OrgSection = 'shelter' | 'rescue' | 'clinic' | 'sponsor' | 'other';

const ALIASES: Record<string, OrgSection> = {
  shelter: 'shelter',
  animal_shelter: 'shelter',
  rescue: 'rescue',
  rescue_group: 'rescue',
  clinic: 'clinic',
  veterinary_clinic: 'clinic',
  vet: 'clinic',
  sponsor: 'sponsor',
  business: 'sponsor',
};

export const ORG_TILE: Record<OrgSection, string> = {
  shelter: '#26265E',
  rescue: '#2E9E96',
  clinic: '#E97F2E',
  sponsor: '#E5A415',
  other: '#6B5CA5',
};

export const ORG_TYPE_LABEL: Record<OrgSection, string> = {
  shelter: 'Shelter',
  rescue: 'Rescue group',
  clinic: 'Clinic',
  sponsor: 'Sponsor',
  other: 'Organization',
};

export function orgSection(raw?: string | null): OrgSection {
  const t = String(raw || '').toLowerCase().trim();
  if (!t) return 'other';
  return ALIASES[t] || 'other';
}

export function orgTypeLabel(raw?: string | null): string {
  return ORG_TYPE_LABEL[orgSection(raw)];
}

export function orgTileColor(raw?: string | null): string {
  return ORG_TILE[orgSection(raw)];
}

export function orgListsPets(raw?: string | null): boolean {
  const s = orgSection(raw);
  return s === 'shelter' || s === 'rescue';
}
