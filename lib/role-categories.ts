export type RoleCategory = 'owner' | 'provider' | 'organization' | 'campaign';

export const ROLE_CARDS: {
  key: RoleCategory;
  title: string;
  description: string;
  chips: string[];
  color: string;
  tile: string;
  mark: string;
}[] = [
  {
    key: 'owner',
    title: 'Owner',
    description: "Keep your pets' records, foster, volunteer, or respond to emergencies.",
    chips: ['Pet owner', 'Volunteer', 'First responder'],
    color: '#E85A50',
    tile: '#FDECEB',
    mark: '♥',
  },
  {
    key: 'provider',
    title: 'Service Provider',
    description: 'Pet sitter, walker, groomer, trainer, transport — get booked by owners and shelters.',
    chips: ['Pet sitter', 'Pet walker', 'Groomer', 'Transport'],
    color: '#2E9E96',
    tile: '#E4F3F1',
    mark: '✦',
  },
  {
    key: 'organization',
    title: 'Organization',
    description: 'Shelter, rescue group, clinic or sponsor — manage pets, members and campaigns.',
    chips: ['Shelter', 'Rescue group', 'Clinic', 'Sponsor'],
    color: '#26265E',
    tile: '#EEF0F8',
    mark: 'H',
  },
  {
    key: 'campaign',
    title: 'Campaign Manager',
    description: 'Run fundraising, adoption events and awareness campaigns for organizations.',
    chips: ['Fundraising', 'Events', 'Awareness'],
    color: '#8A5A00',
    tile: '#FCF4DF',
    mark: '▲',
  },
];

export const TABS_BY_VIEW: Record<RoleCategory, { key: string; label: string }[]> = {
  owner: [
    { key: 'pets', label: 'My Pets' },
    { key: 'reports', label: 'My Reports' },
    { key: 'services', label: 'My Services' },
    { key: 'apps', label: 'My Applications' },
    { key: 'campaigns', label: 'My Campaigns' },
    { key: 'identity', label: 'My Identity' },
  ],
  provider: [
    { key: 'services', label: 'My Services' },
    { key: 'bookings', label: 'My Bookings' },
    { key: 'pets', label: 'My Pets' },
    { key: 'reviews', label: 'My Reviews' },
    { key: 'identity', label: 'My Identity' },
  ],
  organization: [
    { key: 'petmgmt', label: 'Pet Management' },
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'orgservices', label: 'Services' },
    { key: 'shared', label: 'Shared Services' },
    { key: 'company', label: 'Company Registration' },
    { key: 'identity', label: 'My Identity' },
  ],
  campaign: [
    { key: 'campaigns', label: 'My Campaigns' },
    { key: 'orgs', label: 'Organizations' },
    { key: 'donors', label: 'Donors' },
    { key: 'identity', label: 'My Identity' },
  ],
};

export const SUBS: Record<string, { key: string; label: string }[]> = {
  pets: [
    { key: 'own', label: 'I Own' },
    { key: 'foster', label: 'Pets I Foster' },
    { key: 'community', label: 'Community' },
    { key: 'manage', label: 'I Manage' },
    { key: 'shared', label: 'Shared with me' },
  ],
  services: [
    { key: 'offered', label: 'Offered' },
    { key: 'duty', label: 'On duty' },
    { key: 'history', label: 'History' },
  ],
  apps: [
    { key: 'adoption', label: 'Adoption' },
    { key: 'foster', label: 'Foster' },
    { key: 'volunteer', label: 'Volunteer' },
  ],
  campaigns: [
    { key: 'active', label: 'Active' },
    { key: 'draft', label: 'Draft' },
    { key: 'ended', label: 'Ended' },
  ],
  bookings: [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'requests', label: 'Requests' },
    { key: 'past', label: 'Past' },
  ],
  reviews: [{ key: 'all', label: 'All' }],
  petmgmt: [
    { key: 'adoptable', label: 'Adoptable' },
    { key: 'foster', label: 'In foster' },
    { key: 'hold', label: 'Medical hold' },
    { key: 'adopted', label: 'Adopted' },
  ],
  orgservices: [
    { key: 'transport', label: 'Transport' },
    { key: 'foster', label: 'Foster network' },
    { key: 'clinic', label: 'Clinic partners' },
  ],
  shared: [
    { key: 'received', label: 'Received' },
    { key: 'offered', label: 'Offered' },
  ],
  company: [
    { key: 'profile', label: 'Profile' },
    { key: 'verification', label: 'Verification' },
    { key: 'members', label: 'Members' },
  ],
  orgs: [{ key: 'all', label: 'All' }],
  donors: [{ key: 'all', label: 'All' }],
};

export const PROVIDER_SERVICES = [
  { key: 'sitter', label: 'Pet sitter' },
  { key: 'walker', label: 'Pet walker' },
  { key: 'groomer', label: 'Groomer' },
  { key: 'trainer', label: 'Trainer' },
  { key: 'transport', label: 'Transport' },
  { key: 'boarding', label: 'Boarding' },
];

export function cardFor(key: RoleCategory) {
  return ROLE_CARDS.find((c) => c.key === key)!;
}

export function normalizeCategories(raw: unknown): RoleCategory[] {
  const allowed: RoleCategory[] = ['owner', 'provider', 'organization', 'campaign'];
  const arr = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
  const out = allowed.filter((k) => arr.includes(k));
  return out.length ? out : ['owner'];
}

export function dashAction(tab: string): { label: string; href: string } {
  switch (tab) {
    case 'pets': return { label: 'Add a pet', href: '/add-pet' };
    case 'reports': return { label: 'File a report', href: '/report' };
    case 'services': return { label: 'Offer a service', href: '/service-provider' };
    case 'apps': return { label: 'Browse pets to apply', href: '/(tabs)/pets' };
    case 'campaigns': return { label: 'Start a campaign', href: '/campaign-new' };
    case 'bookings': return { label: 'Set availability', href: '/service-provider' };
    case 'petmgmt': return { label: 'Add a pet to your org', href: '/add-pet' };
    case 'orgservices': return { label: 'Add a service', href: '/service-provider' };
    case 'shared': return { label: 'Share a service', href: '/share-service' };
    case 'company': return { label: 'Invite a member', href: '/org-admin' };
    case 'reviews': return { label: 'Offer a service', href: '/service-provider' };
    default: return { label: 'Continue', href: '/(tabs)' };
  }
}

