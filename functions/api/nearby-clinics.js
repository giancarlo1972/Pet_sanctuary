function parseHHMM(t) {
  const s = String(t || '0000').padStart(4, '0');
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(2, 4));
}

function is24h(oh) {
  if (!oh) return false;
  const text = (oh.weekday_text || []).join(' ').toLowerCase();
  if (text.includes('24 hour') || text.includes('open 24')) return true;
  const periods = oh.periods || [];
  return periods.length === 1 && String(periods[0].open?.time || '') === '0000' && !periods[0].close;
}

function minutesToClose(oh) {
  if (!oh?.periods) return null;
  const now = new Date();
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  for (const p of oh.periods) {
    if (Number(p.open?.day) !== day) continue;
    const openM = parseHHMM(p.open.time);
    const closeM = p.close ? parseHHMM(p.close.time) : 24 * 60;
    if (closeM > openM) {
      if (mins >= openM && mins < closeM) return closeM - mins;
    } else {
      // overnight
      if (mins >= openM || mins < closeM) {
        return mins >= openM ? (24 * 60 - mins) + closeM : closeM - mins;
      }
    }
  }
  return null;
}

function statusOf(oh, erHint) {
  const h24 = is24h(oh) || erHint;
  if (h24) return { code: 'open_24h', label: 'Open 24h', minutes: null };
  const openNow = Boolean(oh?.open_now);
  const left = minutesToClose(oh);
  if (openNow && left != null && left <= 90) {
    return { code: 'closing_soon', label: left <= 30 ? `Closing in ${left} min` : 'Closing soon', minutes: left };
  }
  if (openNow) return { code: 'open', label: 'Open', minutes: left };
  return { code: 'closed', label: 'Closed', minutes: null };
}

function mapPlace(p, details, kind) {
  const oh = details.opening_hours || p.opening_hours || {};
  const blob = `${p.name} ${p.vicinity || ''} ${details.name || ''}`;
  const er = kind === 'clinic' && /emerg|24 hour|critical care|bluepearl|er vet|emergency/i.test(blob);
  const st = statusOf(oh, er);
  return {
    id: p.place_id,
    kind,
    name: p.name,
    address: details.formatted_address || p.vicinity || '',
    lat: p.geometry?.location?.lat,
    lng: p.geometry?.location?.lng,
    open_now: st.code === 'open' || st.code === 'open_24h' || st.code === 'closing_soon',
    status: st.code,
    status_label: st.label,
    minutes_to_close: st.minutes,
    hours: oh.weekday_text || [],
    is_24h: st.code === 'open_24h',
    is_er: er || st.code === 'open_24h',
    phone: details.formatted_phone_number || null,
    website: details.website || null,
    maps_url: details.url || null,
    rating: p.rating || null,
  };
}

const FALLBACK = {
  clinic: [
    { id: 'bond', kind: 'clinic', name: 'Bond Vet', address: 'Hours on bondvet.com', website: 'https://bondvet.com', status: 'unknown', status_label: 'See site hours', hours: ['Posted on bondvet.com'], is_24h: false, is_er: false },
    { id: 'smalldoor', kind: 'clinic', name: 'Small Door Veterinary', address: 'Hours on smalldoorvet.com', website: 'https://www.smalldoorvet.com', status: 'unknown', status_label: 'See site hours', hours: ['Posted on smalldoorvet.com'], is_24h: false, is_er: false },
    { id: 'bluepearl', kind: 'clinic', name: 'BluePearl Pet Hospital (ER)', address: '24-hour emergency', website: 'https://bluepearlvet.com', status: 'open_24h', status_label: 'Open 24h', hours: ['Open 24 hours'], is_24h: true, is_er: true },
  ],
  shelter: [
    { id: 'humane', kind: 'shelter', name: 'Local humane society / rescue', address: 'Search Rescue Army orgs', website: null, status: 'unknown', status_label: 'Check listing', hours: [], is_24h: false, is_er: false },
  ],
};

function summarize(clinics) {
  return {
    count: clinics.length,
    open: clinics.filter((c) => c.status === 'open' || c.status === 'open_24h').length,
    closing_soon: clinics.filter((c) => c.status === 'closing_soon').length,
    closed: clinics.filter((c) => c.status === 'closed').length,
    er_24h: clinics.filter((c) => c.is_24h || c.is_er).length,
  };
}

export async function onRequestGet(context) {
  const key = context.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || context.env.GOOGLE_MAPS_API_KEY || context.env.GOOGLE_PLACES_API_KEY;
  const url = new URL(context.request.url);
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  const kind = url.searchParams.get('kind') === 'shelter' ? 'shelter' : 'clinic';

  if (!key || !lat || !lng) {
    const clinics = FALLBACK[kind];
    return Response.json({ clinics, ...summarize(clinics), source: 'directory', kind });
  }

  const keyword = kind === 'shelter' ? 'animal shelter rescue' : 'veterinary clinic';
  const type = kind === 'shelter' ? 'point_of_interest' : 'veterinary_care';
  const extra = kind === 'clinic' ? 'emergency veterinarian 24 hour' : 'animal shelter';

  async function nearby(kw) {
    const u = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=20000&type=${type}&keyword=${encodeURIComponent(kw)}&key=${key}`;
    const res = await fetch(u);
    return res.json();
  }

  try {
    const [a, b] = await Promise.all([nearby(keyword), nearby(extra)]);
    const seen = new Map();
    for (const p of [...(b.results || []), ...(a.results || [])]) {
      if (p.place_id && !seen.has(p.place_id)) seen.set(p.place_id, p);
    }
    const top = [...seen.values()].slice(0, 10);
    const detailed = await Promise.all(top.map(async (p) => {
      try {
        const u = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=formatted_address,formatted_phone_number,website,url,opening_hours,name&key=${key}`;
        const d = await fetch(u).then((r) => r.json());
        return mapPlace(p, d.result || {}, kind);
      } catch {
        return mapPlace(p, {}, kind);
      }
    }));
    const clinics = detailed.filter(Boolean);
    return Response.json({ clinics, ...summarize(clinics), source: 'google', kind });
  } catch (e) {
    const clinics = FALLBACK[kind];
    return Response.json({ clinics, ...summarize(clinics), source: 'directory', kind, error: String(e) });
  }
}
