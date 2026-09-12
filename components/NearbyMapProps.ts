export type NearbyLayer = 'reports' | 'pets' | 'clinics' | 'providers' | 'community';

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
  glyph?: string;
  tag?: string;
  tagFg?: string;
  tagBg?: string;
  /** Teal-outline community pin (white fill, colored stroke). */
  outline?: boolean;
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
