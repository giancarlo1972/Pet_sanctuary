const UA = { headers: { 'User-Agent': 'RescueArmy/1.0 (hub-preview.pet-sanctuary.pages.dev)' } };

export function placeKey(q) {
  return String(q || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function photon(q) {
  const res = await fetch(
    'https://photon.komoot.io/api/?limit=5&lang=en&q=' + encodeURIComponent(q),
    UA,
  );
  const json = await res.json();
  const feats = Array.isArray(json?.features) ? json.features : [];
  const city = feats.find((f) => {
    const p = f?.properties || {};
    return p.type === 'city' || ['city', 'town', 'village', 'hamlet'].includes(p.osm_value);
  }) || feats[0];
  const c = city?.geometry?.coordinates;
  if (!Array.isArray(c) || c.length < 2) return null;
  const lng = Number(c[0]);
  const lat = Number(c[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function nominatim(q) {
  const res = await fetch(
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=' + encodeURIComponent(q),
    UA,
  );
  const arr = await res.json();
  const hit = Array.isArray(arr) ? arr[0] : null;
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export async function geocodeOne(q) {
  const query = String(q || '').trim();
  if (!query) return null;
  try {
    const loc = await photon(query);
    if (loc) return loc;
  } catch {}
  try {
    return await nominatim(query);
  } catch {
    return null;
  }
}

export async function geocodeList(queries) {
  const unique = [...new Set((queries || []).map(placeKey).filter(Boolean))];
  const out = {};
  const misses = [];
  const chunk = 8;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    await Promise.all(slice.map(async (q) => {
      try {
        const loc = await photon(q);
        if (loc) out[q] = loc;
        else misses.push(q);
      } catch {
        misses.push(q);
      }
    }));
  }
  for (const q of misses) {
    try {
      const loc = await nominatim(q);
      if (loc) out[q] = loc;
    } catch {}
    await new Promise((r) => setTimeout(r, 1100));
  }
  return out;
}
