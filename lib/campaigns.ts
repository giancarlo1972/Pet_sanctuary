export type CampaignKind = 'petition' | 'fundraiser' | 'fundraising' | 'event' | 'awareness';

export type Campaign = {
  id: string;
  title: string;
  kind: CampaignKind | string;
  type?: string | null;
  status: string;
  org_id?: string | null;
  manager_id?: string | null;
  target?: string | null;
  goal_count?: number | null;
  signature_count?: number | null;
  baseline_count?: number | null;
  body?: string | null;
  body_md?: string | null;
  why_it_matters?: string | null;
  cover_url?: string | null;
  tags?: string[] | null;
  goal_amount?: number | null;
  raised_amount?: number | null;
  org?: {
    id?: string;
    name?: string | null;
    ein_verified?: boolean | null;
    verification_method?: string | null;
    logo_url?: string | null;
  } | null;
};

export type PetitionSignature = {
  id: string;
  name: string;
  city?: string | null;
  comment?: string | null;
  created_at: string;
};

export function campaignType(c: { type?: string | null; kind?: string | null }): string {
  const t = String(c.type || c.kind || '').toLowerCase();
  if (t === 'fundraising') return 'fundraiser';
  return t || 'awareness';
}

export function campaignTypeLabel(c: { type?: string | null; kind?: string | null }): string {
  const t = campaignType(c);
  if (t === 'petition') return 'Petition';
  if (t === 'fundraiser') return 'Fundraiser';
  if (t === 'event') return 'Event';
  return 'Awareness';
}

export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

export function progressPct(count?: number | null, goal?: number | null): number {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((count || 0) / goal) * 100)));
}

export function firstName(full?: string | null): string {
  const p = String(full || '').trim().split(/\s+/)[0];
  return p || 'Supporter';
}

export function isRemoteUrl(url?: string | null): boolean {
  return Boolean(url && /^https?:\/\//i.test(url));
}

export function typeForKind(kind: string): string {
  if (kind === 'fundraising') return 'fundraiser';
  return kind;
}

export const CAMPAIGN_SELECT = 'id, title, kind, type, status, org_id, manager_id, target, goal_count, signature_count, baseline_count, body, body_md, why_it_matters, cover_url, tags, goal_amount, raised_amount, organizations(id, name, ein_verified, verification_method, logo_url)';
