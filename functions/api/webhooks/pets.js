function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

function allowed(request, env) {
  const secret = env.WEBHOOK_SECRET || env.RESCUE_ARMY_WEBHOOK_SECRET;
  if (!secret) return false;
  const hdr = request.headers.get('authorization') || '';
  const alt = request.headers.get('x-rescue-army-secret') || '';
  const bearer = hdr.toLowerCase().startsWith('bearer ') ? hdr.slice(7).trim() : '';
  return alt === secret || bearer === secret;
}

async function sb(env, path, method, body) {
  const url = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) return { ok: false, error: 'Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) on Cloudflare Pages env' };
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

function rowFromMapped(mapped, event) {
  const adopted = /adopted/i.test(mapped.status || '') || event === 'animal.adopted';
  return {
    name: mapped.name,
    breed: mapped.breed,
    species: mapped.species,
    age_text: mapped.age_text,
    gender: mapped.gender,
    description: mapped.description,
    main_photo_url: mapped.main_photo_url || mapped.photo_url,
    location: mapped.location,
    vaccinated: !!mapped.vaccinated,
    spayed_neutered: !!mapped.spayed_neutered,
    microchipped: !!mapped.microchipped,
    status: adopted ? 'adopted' : 'available',
    availability: mapped.availability || (adopted ? 'none' : 'both'),
    is_public: !adopted,
    external_source: 'rescuegroups',
    external_id: String(mapped.id || '').replace(/^rg-a-/, ''),
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!allowed(request, env)) return unauthorized();
  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'JSON body required' }, { status: 400 });
  }
  const event = body.event || 'animal.updated';
  const mapped = body.pet || body.animal;
  if (!mapped || !(mapped.id || mapped.name)) {
    return Response.json({ error: 'pet or animal object required' }, { status: 400 });
  }
  const ext = String(mapped.id || mapped.animalID || '').replace(/^rg-a-/, '');
  const sync = {
    source: body.source || 'rescuegroups',
    external_id: ext,
    status: mapped.status || null,
    event,
    payload: mapped,
    updated_at: new Date().toISOString(),
  };
  const syncRes = await sb(env, 'pet_sync?on_conflict=source,external_id', 'POST', sync);
  if (!syncRes.ok) {
    return Response.json({ error: 'pet_sync upsert failed', detail: syncRes.json }, { status: 502 });
  }
  const petRow = rowFromMapped(mapped, event);
  const petRes = await sb(env, 'pets?on_conflict=external_source,external_id', 'POST', petRow);
  return Response.json({
    ok: true,
    event,
    external_id: ext,
    adopted: petRow.status === 'adopted',
    sync: syncRes.status,
    pet: petRes.ok ? petRes.json : { warning: 'pets upsert skipped or failed', detail: petRes.json },
  });
}

export async function onRequestGet() {
  return Response.json({
    endpoint: '/api/webhooks/pets',
    method: 'POST',
    headers: { Authorization: 'Bearer WEBHOOK_SECRET', 'Content-Type': 'application/json' },
    body: { source: 'rescuegroups', event: 'animal.updated|animal.adopted', pet: { id: 'rg-a-123', name: 'Jenna', status: 'Available' } },
    note: 'RescueGroups does not push webhooks. Call this from our poller, Zapier, or an org tool. Adopted listings set availability none; owner claim is still Add to my pets.',
  });
}
