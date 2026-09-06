export const GINA = {
  name: 'Gina',
  subtitle: 'Domestic Shorthair mix · Female · Spayed',
  photo: 'https://images.pexels.com/photos/416160/pexels-photo-416160.jpeg?auto=compress&cs=tinysrgb&w=1200',
  weightLb: '18.3 lb',
  chip: '900263003877863',
  chips: ['FELV negative', 'Spayed/Neutered', 'Microchipped', 'Vaccinated'],
  device: {
    brand: 'SiiPet',
    name: 'LitterLens',
    detail: 'Stool & urination monitoring · demo telemetry until SiiPet opens partner access',
    stats: [
      { label: 'Last stool log', value: 'Normal' },
      { label: 'Visits (7-day avg)', value: '2.1/day' },
      { label: 'Scale weight', value: '18.3 lb' },
    ],
    events: [
      { at: 'Today 6:14a', kind: 'Urine', note: 'Normal duration' },
      { at: 'Yesterday 8:02p', kind: 'Stool', note: 'Shape normal · color brown' },
      { at: 'Yesterday 7:11a', kind: 'Urine', note: 'Normal duration' },
    ],
    shopUrl: 'https://siipet.com/products/litterlens',
  },
  insurance: {
    carrier: 'Lemonade',
    plan: 'Lemonade Pet · Accident & Illness',
    policy: 'Policy lives in the Lemonade app — Rescue Army does not store card or login data',
    fileClaimUrl: 'https://www.lemonade.com/pet/explained/how-to-file-a-pet-insurance-claim/',
    claims: [
      { title: 'Acute vomiting — exam + labs', amount: '+$184', meta: 'Aug 30, 2026 · Bond Vet · Reimbursed in Lemonade' },
    ],
  },
  dutch: {
    name: 'Dutch',
    detail: 'Online vet telehealth. They are the vet — Rescue Army does not diagnose or prescribe.',
    url: 'https://www.dutch.com/',
  },
  pharmacy: {
    detail: 'Share the vet diagnosis + receipt with the pharmacy. A sponsor fund or the owner pays the pharmacy — never Rescue Army.',
  },
  vaccines: [
    { name: 'PUREVAX Rabies Feline 3 yr', valid: 'Valid thru Aug 2029', given: 'Aug 6, 2026 · at home Vet', next: 'Aug 6, 2029' },
    { name: 'PUREVAX FVRCP 1 yr', valid: 'Valid thru Aug 2027', given: 'Aug 6, 2026 · at home veterinary', next: 'Aug 6, 2027' },
  ],
  labs: [
    { name: 'FELV / FIV', result: 'Negative', date: 'Aug 6, 2026 · Bond Vet' },
    { name: 'CBC / chemistry', result: 'Within range', date: 'Aug 30, 2026 · Bond Vet' },
  ],
  invoices: [
    { vendor: 'Bond Vet', desc: 'Acute vomiting — exam + labs', amount: '$230.00', status: 'Reimbursed $184 via Lemonade', date: 'Aug 30, 2026' },
    { vendor: 'At-home veterinary', desc: 'PUREVAX Rabies 3-yr + FVRCP', amount: '$145.00', status: 'Paid', date: 'Aug 6, 2026' },
  ],
  aiNote:
    'Litter-box visits are stable at 2.1/day. Weight 18.3 lb is unchanged. This is AI reasoning, not a diagnosis.',
};
