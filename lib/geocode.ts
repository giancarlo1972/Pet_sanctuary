const cache = new Map<string, { lat: number; lng: number }>();

function placeKey(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

function asLoc(raw: any): { lat: number; lng: number } | null {
  const lat = Number(raw?.lat);
  const lng = Number(raw?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return null;
  return { lat, lng };
}

export async function geocodePlace(q: string): Promise<{ lat: number; lng: number } | null> {
  const map = await geocodeMany([q]);
  return map.get(placeKey(q)) || null;
}

export async function geocodeMany(queries: string[]): Promise<Map<string, { lat: number; lng: number }>> {
  const unique = [...new Set(queries.map(placeKey).filter(Boolean))];
  const out = new Map<string, { lat: number; lng: number }>();
  const missing: string[] = [];
  for (const q of unique) {
    const hit = cache.get(q);
    if (hit) out.set(q, hit);
    else missing.push(q);
  }
  if (!missing.length) return out;
  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: missing }),
    });
    const json = await res.json();
    const results = json.results || {};
    if (missing.length === 1 && !json.results) {
      const loc = asLoc(json);
      if (loc) {
        cache.set(missing[0], loc);
        out.set(missing[0], loc);
      }
      return out;
    }
    for (const q of missing) {
      const loc = asLoc(results[q]);
      if (loc) {
        cache.set(q, loc);
        out.set(q, loc);
      }
    }
  } catch {}
  return out;
}

export async function reverseGeocode(lat: number, lng: number): Promise<{
  city?: string;
  state?: string;
  stateCode?: string;
  label?: string;
} | null> {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
    const json = await res.json();
    return {
      city: json.city || undefined,
      state: json.state || undefined,
      stateCode: json.state_code || undefined,
      label: json.label || undefined,
    };
  } catch {
    return null;
  }
}
