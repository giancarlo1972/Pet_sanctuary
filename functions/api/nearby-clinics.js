function is24h(oh) {
  if (!oh) return false;
  const text = (oh.weekday_text || []).join(' ').toLowerCase();
  if (text.includes('24 hour') || text.includes('open 24')) return true;
  const periods = oh.periods || [];
  return periods.length === 1 && String(periods[0].open?.time || '') === '0000' && !periods[0].close;
}

function mapPlace(p, details) {
  const oh = details.opening_hours || p.opening_hours || {};
  const er = /emerg|24|critical|bluepearl|vca animal emergency|er vet/i.test(`${p.name} ${p.vicinity || ''}`);
  return {
    id: p.place_id,
    name: p.name,
    address: details.formatted_address || p.vicinity || '',
    lat: p.geometry?.location?.lat,
    lng: p.geometry?.location?.lng,
    open_now: Boolean(oh.open_now),
    hours: oh.weekday_text || [],
    is_24h: is24h(oh) || er,
    is_er: er || is24h(oh),
    phone: details.formatted_phone_number || null,
    website: details.website || null,
    maps_url: details.url || null,
    rating: p.rating || null,
  };
}

const FALLBACK = [
  { id: 'bond', name: 'Bond Vet', address: 'See bondvet.com for locations & hours', website: 'https://bondvet.com', is_24h: false, is_er: false, hours: ['Hours posted on bondvet.com'], lat: null, lng: null },
  { id: 'smalldoor', name: 'Small Door Veterinary', address: 'See smalldoorvet.com for locations & hours', website: 'https://www.smalldoorvet.com', is_24h: false, is_er: false, hours: ['Hours posted on smalldoorvet.com'], lat: null, lng: null },
  { id: 'bluepearl', name: 'BluePearl Pet Hospital (ER)', address: '24-hour emergency — locations on bluepearlvet.com', website: 'https://bluepearlvet.com', is_24h: true, is_er: true, hours: ['Open 24 hours (ER hospitals)'], lat: null, lng: null },
];

export async function onRequestGet(context) {
  const key = context.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || context.env.GOOGLE_MAPS_API_KEY || context.env.GOOGLE_PLACES_API_KEY;
  const url = new URL(context.request.url);
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');
  if (!key) {
    return Response.json({ clinics: FALLBACK, count: FALLBACK.length, open_now: 0, er_24h: 1, source: 'directory', note: 'Add Google Maps key on Cloudflare to show places next to you.' });
  }
  if (!lat || !lng) {
    return Response.json({ clinics: FALLBACK, count: FALLBACK.length, open_now: 0, er_24h: 1, source: 'directory' });
  }

  async function nearby(keyword) {
    const u = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=20000&type=veterinary_care&keyword=${encodeURIComponent(keyword)}&key=${key}`;
    const res = await fetch(u);
    return res.json();
  }

  try {
    const [vet, er] = await Promise.all([nearby('veterinary clinic'), nearby('emergency veterinarian 24 hour')]);
    const seen = new Map();
    for (const p of [...(er.results || []), ...(vet.results || [])]) {
      if (p.place_id && !seen.has(p.place_id)) seen.set(p.place_id, p);
    }
    const top = [...seen.values()].slice(0, 10);
    const detailed = await Promise.all(top.map(async (p) => {
      try {
        const u = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=formatted_address,formatted_phone_number,website,url,opening_hours,name&key=${key}`;
        const d = await fetch(u).then((r) => r.json());
        return mapPlace(p, d.result || {});
      } catch {
        return mapPlace(p, {});
      }
    }));
    const clinics = detailed.filter(Boolean);
    return Response.json({
      clinics,
      count: clinics.length,
      open_now: clinics.filter((c) => c.open_now).length,
      er_24h: clinics.filter((c) => c.is_24h || c.is_er).length,
      source: 'google',
    });
  } catch (e) {
    return Response.json({ clinics: FALLBACK, count: FALLBACK.length, open_now: 0, er_24h: 1, source: 'directory', error: String(e) });
  }
}
