export type NearbyLayer = 'reports' | 'pets' | 'clinics' | 'providers';

export type NearbyPin = {
  id: string;
  layer: NearbyLayer;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  color: string;
  href: string;
  initial?: string;
  count?: number;
};

export type NearbyMapProps = {
  center: { lat: number; lng: number };
  zoom?: number;
  radiusKm: number;
  pins: NearbyPin[];
  selectedId?: string | null;
  onSelect: (pin: NearbyPin) => void;
  /** nearby = search radius + pins; pin = coral location only (report step 3). */
  mode?: 'nearby' | 'pin';
};
