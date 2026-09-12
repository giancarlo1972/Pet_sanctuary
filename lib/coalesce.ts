import { normalizeClinicName, clinicKeysMatch } from '@/lib/clinic-name';

export type Focal = { x: number; y: number };

export const VAX_MATCH_DAYS = 3;

export function filledFieldCount(row: Record<string, any> | null | undefined): number {
  if (!row) return 0;
  return Object.values(row).filter((v) => {
    if (v == null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') return Object.keys(v).length > 0;
    return true;
  }).length;
}

export function unionDocIds(existing: any, docId?: string | null): string[] {
  const raw = existing?.document_ids;
  const ids = Array.isArray(raw) ? raw.map(String) : [];
  if (existing?.source_document_id) ids.push(String(existing.source_document_id));
  if (docId) ids.push(String(docId));
  return [...new Set(ids.filter(Boolean))];
}

export function isoDay(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function daysApart(a?: string | null, b?: string | null): number | null {
  const da = isoDay(a);
  const db = isoDay(b);
  if (!da || !db) return null;
  const ms = Date.parse(`${da}T00:00:00`) - Date.parse(`${db}T00:00:00`);
  if (!Number.isFinite(ms)) return null;
  return Math.abs(ms) / 86400000;
}

export function normalizeAnalyte(name?: string | null): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function labKey(analyte?: string | null, collectedOn?: string | null, clinic?: string | null): string {
  return `${normalizeAnalyte(analyte)}|${isoDay(collectedOn) || ''}|${normalizeClinicName(clinic || '')}`;
}

export function labsMatch(
  a: { analyte?: string | null; name?: string | null; collected_on?: string | null; clinic?: string | null },
  b: { analyte?: string | null; name?: string | null; collected_on?: string | null; clinic?: string | null },
): boolean {
  const aa = normalizeAnalyte(a.analyte || a.name);
  const ba = normalizeAnalyte(b.analyte || b.name);
  if (!aa || aa !== ba) return false;
  if ((isoDay(a.collected_on) || '') !== (isoDay(b.collected_on) || '')) return false;
  const ca = normalizeClinicName(a.clinic || '');
  const cb = normalizeClinicName(b.clinic || '');
  if (!ca && !cb) return true;
  if (!ca || !cb) return true;
  return ca === cb || clinicKeysMatch(ca, cb);
}

export function vaxSameDose(
  aOn?: string | null,
  bOn?: string | null,
  windowDays = VAX_MATCH_DAYS,
): boolean {
  const d = daysApart(aOn, bOn);
  return d != null && d <= windowDays;
}

export function isReminderOnly(row: { administered_on?: string | null; status?: string | null }): boolean {
  return !isoDay(row.administered_on);
}

export function visitClinicKey(clinic?: string | null): string {
  return normalizeClinicName(clinic || '');
}

export function visitsMatch(
  a: { clinic?: string | null; visit_date?: string | null; record_date?: string | null; date?: string | null },
  b: { clinic?: string | null; visit_date?: string | null; record_date?: string | null; date?: string | null },
): boolean {
  const da = isoDay(a.visit_date || a.record_date || a.date);
  const db = isoDay(b.visit_date || b.record_date || b.date);
  if (!da || da !== db) return false;
  const ca = visitClinicKey(a.clinic);
  const cb = visitClinicKey(b.clinic);
  if (!ca || !cb) return true;
  return ca === cb || clinicKeysMatch(ca, cb);
}

export function inferVisitType(row: { clinic?: string | null; reason?: string | null; title?: string | null; visit_type?: string | null } | null | undefined, blob?: string | null): 'telehealth' | 'house_call' | 'in_person' {
  if (row?.visit_type === 'telehealth' || row?.visit_type === 'house_call' || row?.visit_type === 'in_person') {
    return row.visit_type;
  }
  const text = `${row?.clinic || ''} ${row?.reason || ''} ${row?.title || ''} ${blob || ''}`.toLowerCase();
  if (/\bdutch\b|telehealth|tele-health|telemedicine|online visit|virtual (consult|visit|appointment)|video visit/.test(text)) {
    return 'telehealth';
  }
  if (/house\s*call|at[- ]home veterinary|in-home visit/.test(text)) return 'house_call';
  return 'in_person';
}

export function mergeRicher<T extends Record<string, any>>(keep: T, incoming: T): T {
  const out: any = { ...keep };
  for (const [k, v] of Object.entries(incoming || {})) {
    if (v == null || v === '') continue;
    if (out[k] == null || out[k] === '') out[k] = v;
    else if (typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = { ...out[k], ...Object.fromEntries(Object.entries(v).filter(([, x]) => x != null && x !== '')) };
    }
  }
  if (filledFieldCount(incoming) > filledFieldCount(keep)) {
    for (const [k, v] of Object.entries(incoming || {})) {
      if (v != null && v !== '' && (keep[k] == null || keep[k] === '')) out[k] = v;
    }
  }
  return out as T;
}

export function distinctLabCount(rows: any[]): number {
  const seen = new Set<string>();
  for (const r of rows || []) {
    const k = labKey(r.analyte || r.name, r.collected_on, r.clinic);
    if (k.startsWith('|')) continue;
    seen.add(k);
  }
  return seen.size;
}

export function distinctVisitCount(exams: any[], records: any[], docVisits: any[]): number {
  const seen = new Set<string>();
  const push = (clinic?: string | null, date?: string | null) => {
    const d = isoDay(date);
    if (!d) return;
    seen.add(`${visitClinicKey(clinic)}|${d}`);
  };
  for (const e of exams || []) push(e.clinic, e.visit_date);
  for (const m of records || []) {
    const t = String(m.record_type || 'visit').toLowerCase();
    if (t && t !== 'visit') continue;
    push(m.clinic, m.record_date);
  }
  for (const v of docVisits || []) push(v.clinic, v.event_date || v.date || v.visit_date);
  return seen.size;
}

export function clampFocal(f?: Focal | null): Focal | null {
  if (!f || typeof f.x !== 'number' || typeof f.y !== 'number') return null;
  return {
    x: Math.min(1, Math.max(0, f.x)),
    y: Math.min(1, Math.max(0, f.y)),
  };
}
