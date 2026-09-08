export type NearbyLayer = 'reports' | 'pets' | 'clinics';

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
};
