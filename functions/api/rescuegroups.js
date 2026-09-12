import { geocodeList, placeKey } from './_places.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value) {
  return UUID_RE.test(String(value || ''));
}
function canonicalOrgType(t) {
  const s = String(t || '').toLowerCase();
  if (/shelter/.test(s)) return 'shelter';
  if (/clinic|vet/.test(s)) return 'clinic';
  if (/sponsor|business/.test(s)) return 'sponsor';
  return 'rescue';
}

function photoFrom(a) {
  const pic = Array.isArray(a.animalPictures) && a.animalPictures[0];
  if (pic) {
    return pic.urlSecureFullsize || (pic.large && pic.large.url) || pic.urlSecureThumbnail || null;
  }
  return (a.animalThumbnailUrl || '').replace('?width=100', '?width=500') || null;
}
function yes(v) { return String(v || '').toLowerCase() === 'yes'; }
function decode(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n);
      return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const c = parseInt(h, 16);
      return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : _;
    })
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
    .replace(/"/g, '"').replace(/'/g, "'")
    .replace(/</g, '<').replace(/>/g, '>')
    .replace(/&/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) months = 0;
  if (months < 12) return months + ' mo';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? years + ' yr ' + rem + ' mo' : years + ' yr';
}
function sbHeaders(key, extra) {
  return {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
    ...(extra || {}),
  };
}
async function attachOrgUuids(env, orgs) {
  const url = env && (env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL);
  const key = env && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY || env.SUPABASE_SECRET_KEY);
  if (!url || !key || !orgs.length) return orgs;
  try {
    const res = await fetch(url + '/rest/v1/organizations?select=id,name,external_id,data_source,verification_method,status,ein_verified&limit=2000', {
      headers: sbHeaders(key),
    });
    const rows = await res.json();
    if (!Array.isArray(rows)) return orgs;
    const byExt = new Map();
    const byName = new Map();
    for (const r of rows) {
      if (r.external_id) byExt.set(String(r.external_id), r);
      if (r.name) byName.set(String(r.name).toLowerCase(), r);
    }
    const patches = [];
    const inserts = [];
    const out = orgs.map((o) => {
      const hit = byExt.get(o.id) || byName.get(String(o.name || '').toLowerCase());
      if (!hit) {
        inserts.push(o);
        return o;
      }
      const patch = { id: hit.id };
      let need = false;
      if (!hit.external_id) {
        patch.external_id = o.id;
        patch.data_source = hit.data_source || 'rescuegroups';
        need = true;
      }
      const isRg = String(hit.data_source || '').toLowerCase().includes('rescue')
        || String(hit.external_id || o.id || '').startsWith('rg-');
      if (isRg && !hit.verification_method) {
        patch.status = 'approved';
        patch.ein_verified = true;
        patch.verification_method = 'rescuegroups';
        need = true;
      }
      if (need) patches.push(patch);
      return {
        ...o,
        id: hit.id,
        external_id: hit.external_id || o.id,
        verification_method: hit.verification_method || (isRg ? 'rescuegroups' : null),
        ein_verified: hit.ein_verified != null ? hit.ein_verified : (isRg ? true : false),
        status: hit.status || 'approved',
      };
    });
    await Promise.all(patches.map((p) => {
      const { id, ...body } = p;
      return fetch(url + '/rest/v1/organizations?id=eq.' + id, {
        method: 'PATCH',
        headers: sbHeaders(key),
        body: JSON.stringify(body),
      }).catch(() => null);
    }));
    const created = new Map();
    for (const o of inserts) {
      if (!o.name || !o.id) continue;
      const payload = {
        name: o.name,
        org_type: canonicalOrgType(o.org_type),
        city: o.city || null,
        state: o.state || null,
        website: o.website || null,
        contact_email: o.email || null,
        donate_url: o.donation_url || null,
        external_id: o.id,
        data_source: 'rescuegroups',
        status: 'approved',
        ein_verified: true,
        verification_method: 'rescuegroups',
      };
      let ins = await fetch(url + '/rest/v1/organizations', {
        method: 'POST',
        headers: sbHeaders(key, { Prefer: 'return=representation' }),
        body: JSON.stringify(payload),
      }).then((r) => r.json()).catch(() => null);
      if (ins && ins.message) {
        const slim = { ...payload };
        delete slim.donate_url;
        ins = await fetch(url + '/rest/v1/organizations', {
          method: 'POST',
          headers: sbHeaders(key, { Prefer: 'return=representation' }),
          body: JSON.stringify(slim),
        }).then((r) => r.json()).catch(() => null);
      }
      let row = Array.isArray(ins) ? ins[0] : (ins && ins.id ? ins : null);
      if (!row && o.id) {
        const existing = await fetch(
          url + '/rest/v1/organizations?external_id=eq.' + encodeURIComponent(o.id) + '&select=id,external_id,verification_method,ein_verified,status',
          { headers: sbHeaders(key) },
        ).then((r) => r.json()).catch(() => null);
        row = Array.isArray(existing) ? existing[0] : null;
      }
      if (row && row.id) created.set(o.id, row);
    }
    return out.map((o) => {
      if (isUuid(o.id)) return o;
      const row = created.get(o.id);
      if (!row) return o;
      return {
        ...o,
        id: row.id,
        external_id: o.id,
        verification_method: 'rescuegroups',
        ein_verified: true,
        status: 'approved',
      };
    });
  } catch {
    return orgs;
  }
}
function coordsOf(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) < 0.01 && Math.abs(b) < 0.01) return null;
  return { lat: a, lng: b };
}
function mapPet(a) {
  const status = a.animalStatus || 'Available';
  const adopted = /adopted|unavailable|removed/i.test(status);
  const location = (a.animalLocationCitystate || '').trim() || null;
  const given = coordsOf(a.animalLocationLatitude, a.animalLocationLongitude);
  const desc = decode(a.animalDescriptionPlain);
  const t = desc.toLowerCase();
  return {
    id: 'rg-a-' + a.animalID,
    name: a.animalName,
    breed: a.animalBreed || '',
    species: (a.animalSpecies || '').toLowerCase(),
    gender: a.animalSex || null,
    dob: a.animalBirthdate || null,
    age_text: ageFromDob(a.animalBirthdate) || a.animalAgeString || a.animalGeneralAge || null,
    description: desc,
    photo_url: photoFrom(a),
    main_photo_url: photoFrom(a),
    location,
    city: a.animalLocationCitystate || null,
    lat: given?.lat || null,
    lng: given?.lng || null,
    status,
    vaccinated: yes(a.animalUptodate) || yes(a.animalShotsCurrent),
    spayed_neutered: yes(a.animalAltered),
    microchipped: yes(a.animalMicrochipped),
    dewormed: yes(a.animalDewormed) || /\bdewormed\b/.test(t),
    felv_fiv_negative: yes(a.animalFelvFivNegative) || /\bfelv\/fiv negative\b|\bfelv\b.*negative/.test(t),
    needs_foster: yes(a.animalNeedsFoster),
    listing_url: a.animalUrl || null,
    listing_phone: a.animalContactPhone || a.animalOrgPhone || null,
    listing_email: a.animalContactEmail || a.animalOrgEmail || null,
    org_name: a.animalOrgName || null,
    size: a.animalSize || null,
    coat: a.animalCoatLength || a.animalColor || null,
    house_trained: a.animalHousetrained || null,
    special_needs: a.animalSpecialneedsDescription || (yes(a.animalSpecialneeds) ? 'Yes' : null),
    adoption_fee: a.animalAdoptionFee || null,
    color: a.animalColor || null,
    energy: a.animalEnergyLevel || a.animalActivityLevel || null,
    good_with_kids: a.animalOKWithKids || a.animalGoodWithKids || null,
    good_with_dogs: a.animalOKWithDogs || a.animalGoodWithDogs || null,
    good_with_cats: a.animalOKWithCats || a.animalGoodWithCats || null,
    availability: adopted ? 'none' : 'both',
  };
}

async function attachPetCoords(pets) {
  const missing = pets.filter((p) => p.location && !coordsOf(p.lat, p.lng)).map((p) => p.location);
  if (!missing.length) return pets;
  const geo = await geocodeList(missing);
  return pets.map((p) => {
    if (coordsOf(p.lat, p.lng) || !p.location) return p;
    const c = geo[placeKey(p.location)];
    return c ? { ...p, lat: c.lat, lng: c.lng } : p;
  });
}

export async function onRequestGet(context) {
  const key = context.env.EXPO_PUBLIC_RESCUEGROUPS_API_KEY;
  if (!key) return Response.json({ error: 'Missing RescueGroups key' }, { status: 500 });
  const url = new URL(context.request.url);
  const state = url.searchParams.get('state') || 'NY';
  const orgId = (url.searchParams.get('org') || '').replace(/^rg-/, '');
  const animalId = (url.searchParams.get('animal') || '').replace(/^rg-a-/, '');
  const petFields = [
    'animalID','animalName','animalBreed','animalSpecies','animalSex','animalGeneralAge','animalBirthdate','animalAgeString',
    'animalDescriptionPlain','animalThumbnailUrl','animalPictures','animalLocationCitystate',
    'animalLocationLatitude','animalLocationLongitude',
    'animalStatus','animalAltered','animalMicrochipped','animalNeedsFoster','animalOrgID','animalOrgName',
    'animalUptodate','animalShotsCurrent','animalUrl','animalDewormed','animalFelvFivNegative',
    'animalSize','animalColor','animalCoatLength','animalHousetrained','animalSpecialneeds','animalSpecialneedsDescription',
    'animalAdoptionFee','animalEnergyLevel','animalActivityLevel',
    'animalOKWithKids','animalOKWithDogs','animalOKWithCats','animalGoodWithKids','animalGoodWithDogs','animalGoodWithCats',
    'animalContactPhone','animalContactEmail','animalOrgPhone','animalOrgEmail',
  ];

  async function rg(filters, limit) {
    const res = await fetch('https://api.rescuegroups.org/http/v2.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: key, objectType: 'animals', objectAction: 'publicSearch',
        search: { resultStart: 0, resultLimit: limit, filters, fields: petFields },
      }),
    });
    return res.json();
  }

  if (animalId) {
    const json = await rg([{ fieldName: 'animalID', operation: 'equals', criteria: animalId }], 1);
    const a = Object.values(json.data || {})[0];
    if (!a) return Response.json({ pet: null }, { status: 404 });
    const pets = await attachPetCoords([mapPet(a)]);
    return Response.json({ pet: pets[0] });
  }

  if (url.searchParams.get('pets') === '1') {
    const json = await rg([
      { fieldName: 'animalLocationState', operation: 'equals', criteria: state },
      { fieldName: 'animalStatus', operation: 'equals', criteria: 'Available' },
    ], 48);
    const pets = await attachPetCoords(Object.values(json.data || {}).map((a) => mapPet(a)));
    return Response.json({ pets, foundRows: json.foundRows || pets.length });
  }

  if (orgId) {
    const json = await rg([
      { fieldName: 'animalOrgID', operation: 'equals', criteria: orgId },
      { fieldName: 'animalStatus', operation: 'equals', criteria: 'Available' },
    ], 24);
    const pets = await attachPetCoords(Object.values(json.data || {}).map((a) => mapPet(a)));
    return Response.json({ pets, foundRows: json.foundRows || pets.length });
  }

  const res = await fetch('https://api.rescuegroups.org/http/v2.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: key, objectType: 'orgs', objectAction: 'publicSearch',
      search: {
        resultStart: 0, resultLimit: 50,
        filters: [{ fieldName: 'orgState', operation: 'equals', criteria: state }],
        fields: ['orgID','orgName','orgCity','orgState','orgType','orgWebsiteUrl','orgDonationUrl','orgEmail'],
      },
    }),
  });
  const json = await res.json();
  const orgs = Object.values(json.data || {}).map((o) => {
    const city = (o.orgCity || '').trim() || null;
    const st = (o.orgState || '').trim() || null;
    const location = [city, st].filter(Boolean).join(', ');
    return {
      id: 'rg-' + o.orgID,
      name: o.orgName,
      org_type: (o.orgType || 'Rescue').toLowerCase(),
      city,
      state: st,
      location,
      logo_url: null,
      description: o.orgWebsiteUrl || null,
      status: 'approved',
      ein_verified: true,
      verification_method: 'rescuegroups',
      tax_deductible: false,
      website: o.orgWebsiteUrl || null,
      email: o.orgEmail || null,
      donation_url: o.orgDonationUrl || null,
      lat: null,
      lng: null,
    };
  });
  const resolved = await attachOrgUuids(context.env, orgs);
  const geo = await geocodeList(resolved.map((o) => o.location).filter(Boolean));
  for (const o of resolved) {
    const c = o.location ? geo[placeKey(o.location)] : null;
    if (c) { o.lat = c.lat; o.lng = c.lng; }
  }
  return Response.json({ orgs: resolved, foundRows: json.foundRows || resolved.length });
}
