const cache = new Map<string, { lat: number; lng: number } | null>();

function placeKey(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function geocodePlace(q: string): Promise<{ lat: number; lng: number } | null> {
  const key = placeKey(q);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) || null;
  try {
    const res = await fetch('/api/geocode?q=' + encodeURIComponent(key));
    const json = await res.json();
    const lat = Number(json.lat);
    const lng = Number(json.lng);
    const loc = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    cache.set(key, loc);
    return loc;
  } catch {
    cache.set(key, null);
    return null;
  }
}

export async function geocodeMany(queries: string[]): Promise<Map<string, { lat: number; lng: number }>> {
  const unique = [...new Set(queries.map(placeKey).filter(Boolean))];
  const out = new Map<string, { lat: number; lng: number }>();
  for (const q of unique) {
    const loc = await geocodePlace(q);
    if (loc) out.set(q, loc);
  }
  return out;
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ city?: string; state?: string; stateCode?: string } | null> {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
    const json = await res.json();
    return {
      city: json.city || undefined,
      state: json.state || undefined,
      stateCode: json.state_code || undefined,
    };
  } catch {
    return null;
  }
}
