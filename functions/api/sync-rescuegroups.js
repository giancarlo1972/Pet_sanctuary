import { mapPet, rgSearch } from '../lib/rg-map.js';

function allowed(request, env) {
  const secret = env.WEBHOOK_SECRET || env.RESCUE_ARMY_WEBHOOK_SECRET;
  if (!secret) return false;
  const url = new URL(request.url);
  const q = url.searchParams.get('secret') || '';
  const hdr = request.headers.get('authorization') || '';
  const bearer = hdr.toLowerCase().startsWith('bearer ') ? hdr.slice(7).trim() : '';
  const alt = request.headers.get('x-rescue-army-secret') || '';
  return q === secret || bearer === secret || alt === secret;
}

async function push(env, origin, mapped, event) {
  const secret = env.WEBHOOK_SECRET || env.RESCUE_ARMY_WEBHOOK_SECRET;
  const res = await fetch(origin + '/api/webhooks/pets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret },
    body: JSON.stringify({ source: 'rescuegroups', event, pet: mapped }),
  });
  return res.json().catch(() => ({ ok: false }));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!allowed(request, env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const key = env.EXPO_PUBLIC_RESCUEGROUPS_API_KEY;
  if (!key) return Response.json({ error: 'Missing RescueGroups key' }, { status: 500 });
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || 'NY';
  const origin = url.origin;

  const [avail, adopted] = await Promise.all([
    rgSearch(key, [
      { fieldName: 'animalLocationState', operation: 'equals', criteria: state },
      { fieldName: 'animalStatus', operation: 'equals', criteria: 'Available' },
    ], 24),
    rgSearch(key, [
      { fieldName: 'animalLocationState', operation: 'equals', criteria: state },
      { fieldName: 'animalStatus', operation: 'equals', criteria: 'Adopted' },
    ], 12),
  ]);

  const available = Object.values(avail.data || {}).map(mapPet);
  const adoptedPets = Object.values(adopted.data || {}).map(mapPet);
  const results = [];
  for (const p of available) results.push(await push(env, origin, p, 'animal.updated'));
  for (const p of adoptedPets) results.push(await push(env, origin, p, 'animal.adopted'));

  return Response.json({
    ok: true,
    state,
    pulled: { available: available.length, adopted: adoptedPets.length },
    upserted: results.filter((r) => r && r.ok).length,
    adopted_flagged: adoptedPets.map((p) => p.id),
  });
}
