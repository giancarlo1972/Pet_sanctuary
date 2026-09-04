export async function onRequestGet(context) {
  const key = context.env.EXPO_PUBLIC_RESCUEGROUPS_API_KEY;
  if (!key) {
    return Response.json({ orgs: [], error: 'Missing RescueGroups key' }, { status: 500 });
  }
  const state = new URL(context.request.url).searchParams.get('state') || 'NY';
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
        fields: ['orgID', 'orgName', 'orgCity', 'orgState', 'orgType', 'orgWebsite', 'orgDonationUrl', 'orgEmail'],
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
    description: o.orgWebsite || null,
    status: 'approved',
    ein_verified: false,
    tax_deductible: false,
    website: o.orgWebsite || null,
    email: o.orgEmail || null,
    donation_url: o.orgDonationUrl || null,
  }));
  return Response.json({ orgs, foundRows: json.foundRows || orgs.length });
}
