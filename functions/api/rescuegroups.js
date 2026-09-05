export async function onRequestGet(context) {
  const key = context.env.EXPO_PUBLIC_RESCUEGROUPS_API_KEY;
  if (!key) {
    return Response.json({ orgs: [], pets: [], error: 'Missing RescueGroups key' }, { status: 500 });
  }
  const url = new URL(context.request.url);
  const orgId = (url.searchParams.get('org') || '').replace(/^rg-/, '');
  const state = url.searchParams.get('state') || 'NY';
  const animalId = (url.searchParams.get('animal') || '').replace(/^rg-a-/, '');

  if (animalId) {
    const res = await fetch('https://api.rescuegroups.org/http/v2.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: key,
        objectType: 'animals',
        objectAction: 'publicSearch',
        search: {
          resultStart: 0,
          resultLimit: 1,
          filters: [{ fieldName: 'animalID', operation: 'equals', criteria: animalId }],
          fields: ['animalID','animalName','animalBreed','animalSpecies','animalSex','animalGeneralAge','animalDescriptionPlain','animalThumbnailUrl','animalLocationCitystate','animalStatus','animalOrgID'],
        },
      }),
    });
    const json = await res.json();
    const a = Object.values(json.data || {})[0];
    if (!a) return Response.json({ pet: null }, { status: 404 });
    return Response.json({
      pet: {
        id: a.animalID,
        name: a.animalName,
        breed: a.animalBreed || null,
        species: a.animalSpecies || 'Unknown',
        gender: a.animalSex || null,
        age_text: a.animalGeneralAge || null,
        description: a.animalDescriptionPlain || null,
        photo_url: a.animalThumbnailUrl || null,
        location: a.animalLocationCitystate || null,
        status: a.animalStatus || 'Available',
      },
    });
  }
    if (url.searchParams.get('pets') === '1') {
    const res = await fetch('https://api.rescuegroups.org/http/v2.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: key,
        objectType: 'animals',
        objectAction: 'publicSearch',
        search: {
          resultStart: 0,
          resultLimit: 48,
          filters: [
            { fieldName: 'animalLocationState', operation: 'equals', criteria: state },
            { fieldName: 'animalStatus', operation: 'equals', criteria: 'Available' },
          ],
          fields: ['animalID', 'animalName', 'animalBreed', 'animalSpecies', 'animalGeneralAge', 'animalThumbnailUrl', 'animalLocationCitystate'],
        },
      }),
    });
    const json = await res.json();
    const pets = Object.values(json.data || {}).map((a) => ({
      id: 'rg-a-' + a.animalID,
      name: a.animalName,
      breed: a.animalBreed || '',
      species: (a.animalSpecies || '').toLowerCase(),
      age_text: a.animalGeneralAge || null,
      main_photo_url: a.animalThumbnailUrl || null,
      location: a.animalLocationCitystate || null,
      needs_foster: false,
    }));
    return Response.json({ pets, foundRows: json.foundRows || pets.length });
  }
  if (orgId) {
    const res = await fetch('https://api.rescuegroups.org/http/v2.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: key,
        objectType: 'animals',
        objectAction: 'publicSearch',
        search: {
          resultStart: 0,
          resultLimit: 24,
          filters: [
            { fieldName: 'animalOrgID', operation: 'equals', criteria: orgId },
            { fieldName: 'animalStatus', operation: 'equals', criteria: 'Available' },
          ],
          fields: ['animalID', 'animalName', 'animalBreed', 'animalSpecies', 'animalThumbnailUrl', 'animalStatus'],
        },
      }),
    });
    const json = await res.json();
    const pets = Object.values(json.data || {}).map((a) => ({
      id: 'rg-a-' + a.animalID,
      name: a.animalName,
      photo_url: a.animalThumbnailUrl || null,
      breed: a.animalBreed || null,
      species: a.animalSpecies || null,
    }));
    return Response.json({ pets, foundRows: json.foundRows || pets.length });
  }

  const res = await fetch('https://api.rescuegroups.org/http/v2.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: key,
      objectType: 'orgs',
      objectAction: 'publicSearch',
      search: {
        resultStart: 0,
        resultLimit: 50,
        filters: [{ fieldName: 'orgState', operation: 'equals', criteria: state }],
        fields: ['orgID', 'orgName', 'orgCity', 'orgState', 'orgType', 'orgWebsiteUrl', 'orgDonationUrl', 'orgEmail'],
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
    website: o.orgWebsiteUrl || null,
    status: 'approved',
    ein_verified: false,
    tax_deductible: false,
    email: o.orgEmail || null,
    donation_url: o.orgDonationUrl || null,
  }));
  return Response.json({ orgs, foundRows: json.foundRows || orgs.length });
}
