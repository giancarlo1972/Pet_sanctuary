export type PlacePeriod = {
  open_day: number;
  open_time: string;
  close_day?: number | null;
  close_time?: string | null;
};

export type LiveStatus = {
  code: 'open_24h' | 'open' | 'closing_soon' | 'closed' | 'unknown';
  label: string;
  minutes: number | null;
  open: boolean;
};

function parseHHMM(t?: string | null) {
  const s = String(t || '0000').padStart(4, '0');
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(2, 4));
}

function minutesToClose(periods: PlacePeriod[] | undefined, now: Date) {
  if (!periods?.length) return null;
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  for (const p of periods) {
    if (Number(p.open_day) !== day) continue;
    const openM = parseHHMM(p.open_time);
    const closeM = p.close_time ? parseHHMM(p.close_time) : 24 * 60;
    if (closeM > openM) {
      if (mins >= openM && mins < closeM) return closeM - mins;
    } else if (mins >= openM || mins < closeM) {
      return mins >= openM ? 24 * 60 - mins + closeM : closeM - mins;
    }
  }
  return null;
}

function isOpenNow(periods: PlacePeriod[] | undefined, now: Date) {
  if (!periods?.length) return false;
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  for (const p of periods) {
    const od = Number(p.open_day);
    const openM = parseHHMM(p.open_time);
    if (p.close_time == null && od === day && String(p.open_time) === '0000') return true;
    const closeM = p.close_time ? parseHHMM(p.close_time) : 24 * 60;
    const cd = p.close_day == null ? od : Number(p.close_day);
    if (od === cd) {
      if (od === day && mins >= openM && mins < closeM) return true;
    } else {
      if (od === day && mins >= openM) return true;
      if (cd === day && mins < closeM) return true;
    }
  }
  return false;
}

export function liveStatus(input: {
  periods?: PlacePeriod[];
  hours?: string[];
  is_er?: boolean;
  is_24h?: boolean;
  status?: string;
}, now = new Date()): LiveStatus {
  const text = (input.hours || []).join(' ').toLowerCase();
  if (input.is_24h || input.status === 'open_24h' || text.includes('24 hour') || text.includes('open 24')) {
    return { code: 'open_24h', label: 'Open 24h', minutes: null, open: true };
  }
  const periods = input.periods;
  if (!periods?.length) {
    if (input.status === 'open') return { code: 'open', label: 'Open', minutes: null, open: true };
    if (input.status === 'closed') return { code: 'closed', label: 'Closed', minutes: null, open: false };
    return { code: 'unknown', label: 'See hours', minutes: null, open: false };
  }
  const open = isOpenNow(periods, now);
  const left = minutesToClose(periods, now);
  if (open && left != null && left <= 90) {
    return { code: 'closing_soon', label: `Closing in ${left} min`, minutes: left, open: true };
  }
  if (open) return { code: 'open', label: left != null ? `Open · ${left} min left` : 'Open', minutes: left, open: true };
  return { code: 'closed', label: 'Closed', minutes: null, open: false };
}

export function summarizeLive<T extends { status?: string; is_er?: boolean; is_24h?: boolean }>(rows: T[]) {
  return {
    count: rows.length,
    open: rows.filter((r) => r.status === 'open' || r.status === 'open_24h').length,
    closing_soon: rows.filter((r) => r.status === 'closing_soon').length,
    er_24h: rows.filter((r) => r.is_24h || r.is_er || r.status === 'open_24h').length,
  };
}
