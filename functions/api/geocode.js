import { geocodeList, geocodeOne, placeKey } from './_places.js';

const UA = { headers: { 'User-Agent': 'RescueArmy/1.0 (hub-preview.pet-sanctuary.pages.dev)' } };

async function handle(context) {
  const url = new URL(context.request.url);
  const latQ = url.searchParams.get('lat');
  const lngQ = url.searchParams.get('lng') || url.searchParams.get('lon');
  try {
    if (latQ && lngQ) {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(latQ)}&lon=${encodeURIComponent(lngQ)}`,
        UA,
      );
      const hit = await res.json();
      const addr = hit?.address || {};
      const iso = String(addr['ISO3166-2-lvl4'] || '');
      return Response.json({
        lat: Number(hit?.lat) || Number(latQ),
        lng: Number(hit?.lon) || Number(lngQ),
        label: hit?.display_name || null,
        city: addr.city || addr.town || addr.village || addr.hamlet || null,
        state: addr.state || null,
        state_code: iso.includes('-') ? iso.split('-').pop() : null,
      });
    }

    let queries = [];
    if (context.request.method === 'POST') {
      const body = await context.request.json().catch(() => ({}));
      const raw = body.q ?? body.queries ?? [];
      queries = Array.isArray(raw) ? raw : String(raw || '').split('|');
    } else {
      const q = (url.searchParams.get('q') || '').trim();
      queries = q ? q.split('|') : [];
    }
    queries = queries.map((x) => String(x || '').trim()).filter(Boolean);
    if (!queries.length) return Response.json({ lat: null, lng: null }, { status: 400 });

    if (queries.length === 1) {
      const loc = await geocodeOne(queries[0]);
      return Response.json(loc ? { ...loc, label: queries[0] } : { lat: null, lng: null });
    }

    const map = await geocodeList(queries);
    const results = {};
    for (const q of queries) {
      const loc = map[placeKey(q)];
      if (loc) results[placeKey(q)] = loc;
    }
    return Response.json({ results });
  } catch (e) {
    return Response.json({ lat: null, lng: null, error: String(e) }, { status: 502 });
  }
}

export async function onRequestGet(context) {
  return handle(context);
}

export async function onRequestPost(context) {
  return handle(context);
}
