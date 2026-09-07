import { supabase } from '@/lib/supabase';

export type HelpFlags = {
  volunteer_active: boolean;
  responder_active: boolean;
  alert_radius_mi: number;
};

const VOL_TYPES = ['lost', 'stray', 'foster', 'support', 'inform'];
const RESP_TYPES = ['emergency', 'injured', 'road_accident', 'cruelty'];

export function typesForFlags(flags: HelpFlags | null): string[] | null {
  if (!flags) return null;
  const types: string[] = [];
  if (flags.volunteer_active) types.push(...VOL_TYPES);
  if (flags.responder_active) types.push(...RESP_TYPES);
  return types.length ? types : null;
}

export async function loadHelpFlags(userId: string): Promise<HelpFlags> {
  const { data } = await supabase
    .from('profiles')
    .select('volunteer_active, responder_active, alert_radius_mi')
    .eq('id', userId)
    .maybeSingle();
  return {
    volunteer_active: Boolean(data?.volunteer_active),
    responder_active: Boolean(data?.responder_active),
    alert_radius_mi: Number(data?.alert_radius_mi) || 5,
  };
}

export async function loadHelpAlerts(opts: {
  lat?: number | null;
  lng?: number | null;
  flags?: HelpFlags | null;
  limit?: number;
}) {
  const limit = opts.limit ?? 50;
  if (opts.lat != null && opts.lng != null) {
    const { data, error } = await supabase.rpc('nearby_help_alerts', { p_lat: opts.lat, p_lng: opts.lng });
    if (!error && data) return data as any[];
    const km = Math.round((opts.flags?.alert_radius_mi || 5) * 1.609);
    const { data: d2 } = await supabase.rpc('nearby_reports', { p_lat: opts.lat, p_lng: opts.lng, p_radius_km: km });
    if (d2) {
      const types = typesForFlags(opts.flags || null);
      return types ? (d2 as any[]).filter((r) => types.includes(r.report_type)) : d2;
    }
  }
  let q = supabase
    .from('reports')
    .select('id, report_type, severity, status, pet_name, location_address, created_at, description')
    .in('status', ['active', 'open'])
    .order('created_at', { ascending: false })
    .limit(limit);
  const types = typesForFlags(opts.flags || null);
  if (types) q = q.in('report_type', types) as typeof q;
  const { data } = await q;
  return data || [];
}
