export const HELPER_SERVICES = [
  { key: 'transport', label: 'Transport' },
  { key: 'emergency_foster', label: 'Emergency foster' },
  { key: 'supplies', label: 'Supplies' },
  { key: 'vet_ride', label: 'Vet ride' },
  { key: 'tnr', label: 'TNR' },
  { key: 'medical', label: 'Medical' },
  { key: 'search', label: 'Search' },
  { key: 'translation', label: 'Translation' },
] as const;

export const CONTACT_PREFS = [
  { key: 'inapp', label: 'In-app' },
  { key: 'text', label: 'Text' },
  { key: 'call', label: 'Call' },
] as const;

export type HelperStatus = {
  user_id: string;
  on_duty: boolean;
  services: string[];
  radius_mi: number;
  contact_prefs: string[];
  geohash: string | null;
  until_at: string | null;
};

export function hoursLeft(until: string | null) {
  if (!until) return 0;
  return Math.max(0, (new Date(until).getTime() - Date.now()) / 3600000);
}

export function serviceLabel(key: string) {
  return HELPER_SERVICES.find((s) => s.key === key)?.label || key;
}
