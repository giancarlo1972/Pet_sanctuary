export function vaccineType(name: string | null | undefined): string {
  const q = norm(name || '');
  if (!q) return 'Other';
  const types: [string, string[]][] = [
    ['FVRCP', ['fvrcp', 'fvrccp', 'feline distemper', 'rhinotracheitis', 'calici', 'panleukopenia']],
    ['Rabies', ['rabies', 'purevax rabies']],
    ['FeLV', ['felv', 'leukemia', 'feline leukemia']],
    ['DHPP', ['dhpp', 'da2pp', 'distemper parvovirus']],
    ['Bordetella', ['bordetella', 'kennel cough']],
    ['Leptospirosis', ['lepto', 'leptospirosis']],
    ['Lyme', ['lyme', 'borrelia']],
    ['Influenza', ['influenza', 'civ', ' canine flu']],
  ];
  for (const [type, aliases] of types) {
    if (aliases.some((a) => q.includes(a))) return type;
  }
  return name || 'Other';
}