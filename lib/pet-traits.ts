export type PetTrait = { key: string; label: string };

export const PET_TRAITS: PetTrait[] = [
  { key: 'playful', label: 'Playful' },
  { key: 'curious', label: 'Curious' },
  { key: 'calm', label: 'Calm' },
  { key: 'feral', label: 'Feral' },
  { key: 'affectionate', label: 'Affectionate' },
  { key: 'shy', label: 'Shy' },
  { key: 'vocal', label: 'Vocal' },
  { key: 'independent', label: 'Independent' },
  { key: 'gentle', label: 'Gentle' },
  { key: 'energetic', label: 'Energetic' },
  { key: 'good_with_kids', label: 'Good with kids' },
  { key: 'good_with_dogs', label: 'Good with dogs' },
  { key: 'good_with_cats', label: 'Good with cats' },
  { key: 'house_trained', label: 'House trained' },
  { key: 'special_needs', label: 'Special needs' },
];

function titleCase(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function traitLabel(raw: string) {
  const q = raw.trim().toLowerCase().replace(/[_-]+/g, ' ');
  const hit = PET_TRAITS.find((t) => t.key === raw || t.label.toLowerCase() === q || t.key.replace(/_/g, ' ') === q);
  return hit?.label || titleCase(raw.trim());
}

export function normalizeTraits(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw.map((x) => String(x).trim()).filter(Boolean) : [];
  const out: string[] = [];
  for (const item of arr) {
    const label = traitLabel(item);
    if (!out.some((x) => x.toLowerCase() === label.toLowerCase())) out.push(label);
  }
  return out;
}
