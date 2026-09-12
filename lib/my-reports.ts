import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';

export const MY_REPORT_TYPE_LABELS: Record<string, string> = {
  lost: 'Lost pet',
  stray: 'Found stray',
  foster: 'Foster request',
  support: 'Support request',
  inform: 'Authority report',
  emergency: 'Emergency',
  injured: 'Injured animal',
  road_accident: 'Road accident',
  cruelty: 'Cruelty/Neglect',
  lost_found: 'Lost or found',
};

export type MyReport = {
  id: string;
  report_type: string;
  status: string;
  severity: string | null;
  pet_name: string | null;
  location_address: string | null;
  created_at: string;
  description?: string | null;
  photo_url?: string | null;
  photo_urls?: string[] | null;
  animal_kind?: string | null;
  ai_species?: string | null;
  user_id?: string | null;
  last_seen_at?: string | null;
  last_boosted_at?: string | null;
  moderator_note?: string | null;
  resolution_outcome?: string | null;
  cancel_reason?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  match_count?: number;
};

const SELECT_LIST =
  'id, report_type, status, severity, pet_name, location_address, created_at, description, photo_url, photo_urls, animal_kind, ai_species, user_id, last_seen_at, latitude, longitude';
const SELECT_OWNER =
  `${SELECT_LIST}, last_boosted_at, moderator_note, resolution_outcome, cancel_reason`;
const SELECT_SAFE =
  'id, report_type, status, severity, pet_name, location_address, created_at, description, photo_url, photo_urls, animal_kind, ai_species, user_id';
const SELECT_MIN =
  'id, report_type, status, severity, pet_name, location_address, created_at, description, user_id';

export function reportStatusStyle(status: string): { label: string; bg: string; color: string } {
  const v = (status || '').toLowerCase();
  if (v === 'pending_moderation' || v === 'pending') {
    return { label: 'Pending moderation', bg: Colors.standardBg, color: Colors.accentDark };
  }
  if (v === 'active' || v === 'open') {
    return { label: 'Active', bg: Colors.tealBg, color: Colors.tealDark };
  }
  if (v === 'resolved') {
    return { label: 'Resolved', bg: Colors.tealBg, color: Colors.tealDark };
  }
  if (v === 'rejected' || v === 'dismissed') {
    return { label: 'Rejected', bg: Colors.criticalBg, color: Colors.critical };
  }
  if (v === 'cancelled' || v === 'closed') {
    return { label: 'Cancelled', bg: Colors.surface, color: Colors.textSecondary };
  }
  return { label: v.replace(/_/g, ' ') || 'Unknown', bg: Colors.surface, color: Colors.textSecondary };
}

export function reportSeverityStyle(sev: string | null | undefined): { label: string; bg: string; color: string } {
  const v = (sev || 'standard').toLowerCase();
  if (v === 'critical') return { label: 'CRITICAL', bg: Colors.criticalBg, color: Colors.critical };
  if (v === 'urgent') return { label: 'URGENT', bg: Colors.urgentBg, color: Colors.urgent };
  return { label: 'STANDARD', bg: Colors.standardBg, color: Colors.accentDark };
}

export function isLostKind(type: string) {
  return type === 'lost' || type === 'stray' || type === 'lost_found';
}

function shortPlace(addr: string | null | undefined) {
  const s = (addr || '').replace(/^Detected:\s*/i, '').replace(/^Current location.*/, '').trim();
  if (!s) return '';
  return s.split(',').slice(0, 2).join(',').trim();
}

export function reportTitle(r: {
  pet_name?: string | null;
  location_address?: string | null;
  report_type: string;
  animal_kind?: string | null;
  ai_species?: string | null;
}) {
  const type = MY_REPORT_TYPE_LABELS[r.report_type] || 'Report';
  const animal = (r.pet_name || r.animal_kind || r.ai_species || '').trim();
  const place = shortPlace(r.location_address);
  if (animal && place) return `${type} — ${animal}, ${place}`;
  if (animal) return `${type} — ${animal}`;
  if (place) return `${type} — ${place}`;
  return type;
}

export function reportTimeAgo(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

export async function claimMyAnonReports(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('claim_my_anon_reports');
    if (error) return 0;
    return Number(data) || 0;
  } catch {
    return 0;
  }
}

export async function updateMyReport(
  id: string,
  action: 'edit' | 'resolve' | 'cancel' | 'boost',
  payload: Record<string, unknown> = {},
) {
  const { data, error } = await supabase.rpc('update_my_report', {
    p_id: id,
    p_action: action,
    p_payload: payload,
  });
  if (error) throw error;
  const rec = (data || {}) as { ok?: boolean; error?: string; next_at?: string; helpers_notified?: number; status?: string; outcome?: string };
  if (rec.ok === false) {
    const err = new Error(rec.error || 'update_failed') as Error & { code?: string; next_at?: string };
    err.code = rec.error;
    err.next_at = rec.next_at;
    throw err;
  }
  return rec;
}

export function ownerActionMessage(err: any): string {
  const code = String(err?.code || err?.message || '');
  if (code.includes('sign_in_required')) return 'Sign in to manage this report.';
  if (code.includes('not_owner')) return 'Only the reporter can do that.';
  if (code.includes('closed')) return 'This report is closed.';
  if (code.includes('not_live')) return 'Boost is only for live reports.';
  if (code.includes('boost_cooldown')) return 'You can boost once every 24 hours.';
  if (code.includes('outcome_required')) return 'Choose how this was resolved.';
  if (code.includes('reason_required')) return 'Add a reason to cancel.';
  if (code.includes('not_found')) return 'This report could not be found.';
  if (/could not find the function|schema cache|does not exist/i.test(code)) {
    return 'Owner actions are not live yet — paste the My Reports SQL, then retry.';
  }
  return err?.message || 'Could not update this report.';
}

export function boostAvailableAt(last: string | null | undefined): Date | null {
  if (!last) return null;
  const t = new Date(last).getTime() + 24 * 3600 * 1000;
  if (Number.isNaN(t) || t <= Date.now()) return null;
  return new Date(t);
}

export function outcomeLabel(outcome: string | null | undefined): string {
  if (outcome === 'found') return 'Found';
  if (outcome === 'rescued') return 'Rescued';
  if (outcome === 'no_longer_needed') return 'No longer needed';
  return '';
}

async function selectReports(builder: (cols: string) => any, cols: string[] = [SELECT_LIST, SELECT_SAFE, SELECT_MIN]): Promise<MyReport[]> {
  let res: any = { error: true };
  for (const c of cols) {
    res = await builder(c);
    if (!res.error) return (res.data || []) as MyReport[];
  }
  return [];
}

export async function attachMatchCounts(rows: MyReport[]): Promise<MyReport[]> {
  const lost = rows.filter((r) => isLostKind(r.report_type));
  if (!lost.length) return rows.map((r) => ({ ...r, match_count: r.match_count ?? 0 }));
  try {
    const { data } = await supabase
      .from('reports')
      .select('id, ai_species')
      .in('report_type', ['lost', 'stray', 'lost_found'])
      .in('status', ['active', 'open', 'pending_moderation']);
    const bySpecies: Record<string, number> = {};
    for (const r of data || []) {
      const s = String((r as any).ai_species || '').trim();
      if (!s) continue;
      bySpecies[s] = (bySpecies[s] || 0) + 1;
    }
    const ids = new Set((data || []).map((r: any) => r.id));
    return rows.map((r) => {
      if (!isLostKind(r.report_type) || !r.ai_species) return { ...r, match_count: 0 };
      const n = bySpecies[r.ai_species] || 0;
      const self = ids.has(r.id) ? 1 : 0;
      return { ...r, match_count: Math.max(0, n - self) };
    });
  } catch {
    return rows.map((r) => ({ ...r, match_count: 0 }));
  }
}

export async function loadMyReports(userId: string): Promise<MyReport[]> {
  await claimMyAnonReports();
  const rows = await selectReports(
    (cols) => supabase.from('reports').select(cols).eq('user_id', userId).order('created_at', { ascending: false }).limit(80),
    [SELECT_OWNER, SELECT_LIST, SELECT_SAFE, SELECT_MIN],
  );
  return attachMatchCounts(rows);
}

export async function loadPublicReports(): Promise<MyReport[]> {
  const rows = await selectReports((cols) =>
    supabase
      .from('reports')
      .select(cols)
      .in('status', ['active', 'open', 'pending_moderation'])
      .order('created_at', { ascending: false })
      .limit(80),
  );
  return attachMatchCounts(rows);
}
