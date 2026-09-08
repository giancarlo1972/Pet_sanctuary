const UA = { headers: { 'User-Agent': 'RescueArmy/1.0 (hub-preview.pet-sanctuary.pages.dev)' } };

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
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
    if (!q) return Response.json({ lat: null, lng: null }, { status: 400 });
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q),
      UA,
    );
    const arr = await res.json();
    const hit = Array.isArray(arr) ? arr[0] : null;
    if (!hit) return Response.json({ lat: null, lng: null });
    return Response.json({ lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name || q });
  } catch (e) {
    return Response.json({ lat: null, lng: null, error: String(e) }, { status: 502 });
  }
}
