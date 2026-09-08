export function photoFrom(a) {
  const pic = Array.isArray(a.animalPictures) && a.animalPictures[0];
  if (pic) {
    return pic.urlSecureFullsize || (pic.large && pic.large.url) || pic.urlSecureThumbnail || null;
  }
  return (a.animalThumbnailUrl || '').replace('?width=100', '?width=500') || null;
}
export function yes(v) { return String(v || '').toLowerCase() === 'yes'; }
export function decode(s) {
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
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
export function ageFromDob(dob) {
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
export function mapPet(a) {
  const status = a.animalStatus || 'Available';
  const adopted = /adopted|unavailable|removed/i.test(status);
  return {
    id: 'rg-a-' + a.animalID,
    name: a.animalName,
    breed: a.animalBreed || '',
    species: (a.animalSpecies || '').toLowerCase(),
    gender: a.animalSex || null,
    dob: a.animalBirthdate || null,
    age_text: ageFromDob(a.animalBirthdate) || a.animalAgeString || a.animalGeneralAge || null,
    description: decode(a.animalDescriptionPlain),
    photo_url: photoFrom(a),
    main_photo_url: photoFrom(a),
    location: a.animalLocationCitystate || null,
    status,
    vaccinated: yes(a.animalUptodate) || yes(a.animalShotsCurrent),
    spayed_neutered: yes(a.animalAltered),
    microchipped: yes(a.animalMicrochipped),
    needs_foster: yes(a.animalNeedsFoster),
    listing_url: a.animalUrl || null,
    availability: adopted ? 'none' : 'both',
  };
}



export const PET_FIELDS = [
  'animalID','animalName','animalBreed','animalSpecies','animalSex','animalGeneralAge','animalBirthdate','animalAgeString',
  'animalDescriptionPlain','animalThumbnailUrl','animalPictures','animalLocationCitystate',
  'animalStatus','animalAltered','animalMicrochipped','animalNeedsFoster','animalOrgID',
  'animalUptodate','animalShotsCurrent','animalUrl',
];

export async function rgSearch(key, filters, limit) {
  const res = await fetch('https://api.rescuegroups.org/http/v2.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apikey: key, objectType: 'animals', objectAction: 'publicSearch',
      search: { resultStart: 0, resultLimit: limit, filters, fields: PET_FIELDS },
    }),
  });
  return res.json();
}
