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
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&rsquo;/g, "'").replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"').replace(/&ldquo;/g, '"')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function mapPet(a) {
  return {
    id: 'rg-a-' + a.animalID,
    name: a.animalName,
    breed: a.animalBreed || '',
    species: (a.animalSpecies || '').toLowerCase(),
    gender: a.animalSex || null,
    age_text: a.animalGeneralAge || null,
    description: decode(a.animalDescriptionPlain),
    photo_url: photoFrom(a),
    main_photo_url: photoFrom(a),
    location: a.animalLocationCitystate || null,
    status: a.animalStatus || 'Available',
    vaccinated: yes(a.animalUptodate) || yes(a.animalShotsCurrent),
    spayed_neutered: yes(a.animalAltered),
    microchipped: yes(a.animalMicrochipped),
    needs_foster: yes(a.animalNeedsFoster),
  };
}

export async function onRequestGet(context) {
  const key = context.env.EXPO_PUBLIC_RESCUEGROUPS_API_KEY;
  if (!key) return Response.json({ error: 'Missing RescueGroups key' }, { status: 500 });
  const url = new URL(context.request.url);
  const state = url.searchParams.get('state') || 'NY';
  const orgId = (url.searchParams.get('org') || '').replace(/^rg-/, '');
  const animalId = (url.searchParams.get('animal') || '').replace(/^rg-a-/, '');
  const petFields = [
    'animalID','animalName','animalBreed','animalSpecies','animalSex','animalGeneralAge',
    'animalDescriptionPlain','animalThumbnailUrl','animalPictures','animalLocationCitystate',
    'animalStatus','animalAltered','animalMicrochipped','animalNeedsFoster','animalOrgID',
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
    return Response.json({ pet: mapPet(a) });
  }

  if (url.searchParams.get('pets') === '1') {
    const json = await rg([
      { fieldName: 'animalLocationState', operation: 'equals', criteria: state },
      { fieldName: 'animalStatus', operation: 'equals', criteria: 'Available' },
    ], 48);
    const pets = Object.values(json.data || {}).map(mapPet);
    return Response.json({ pets, foundRows: json.foundRows || pets.length });
  }

  if (orgId) {
    const json = await rg([
      { fieldName: 'animalOrgID', operation: 'equals', criteria: orgId },
      { fieldName: 'animalStatus', operation: 'equals', criteria: 'Available' },
    ], 24);
    const pets = Object.values(json.data || {}).map(mapPet);
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
  const orgs = Object.values(json.data || {}).map((o) => ({
    id: 'rg-' + o.orgID,
    name: o.orgName,
    org_type: (o.orgType || 'Rescue').toLowerCase(),
    location: [o.orgCity, o.orgState].filter(Boolean).join(', '),
    logo_url: null,
    description: o.orgWebsiteUrl || null,
    status: 'approved',
    ein_verified: false,
    tax_deductible: false,
    website: o.orgWebsiteUrl || null,
    email: o.orgEmail || null,
    donation_url: o.orgDonationUrl || null,
  }));
  return Response.json({ orgs, foundRows: json.foundRows || orgs.length });
}
