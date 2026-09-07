const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lon: number, precision = 5) {
  let idx = 0;
  let bit = 0;
  let even = true;
  let hash = '';
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  while (hash.length < precision) {
    if (even) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) { idx = idx * 2 + 1; lonMin = mid; } else { idx *= 2; lonMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { idx = idx * 2 + 1; latMin = mid; } else { idx *= 2; latMax = mid; }
    }
    even = !even;
    if (++bit === 5) { hash += BASE32.charAt(idx); bit = 0; idx = 0; }
  }
  return hash;
}

export function decodeGeohash(hash: string): { lat: number; lng: number } {
  let even = true;
  let latMin = -90, latMax = 90, lonMin = -180, lonMax = 180;
  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    for (let n = 4; n >= 0; n--) {
      const bit = (idx >> n) & 1;
      if (even) {
        const mid = (lonMin + lonMax) / 2;
        if (bit) lonMin = mid; else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bit) latMin = mid; else latMax = mid;
      }
      even = !even;
    }
  }
  return { lat: (latMin + latMax) / 2, lng: (lonMin + lonMax) / 2 };
}

const NEIGHBORS: Record<string, [string, string]> = {
  n: ['p0r21436x8zb9dcf5h7kjnmqesgutwvy', 'bc01fg45238967deuvhjyznpkmstqrwx'],
  s: ['14365h7k9dcfesgujnmqp0r2twvyx8zb', '238967debc01fg45kmstqrwxuvhjyznp'],
  e: ['bc01fg45238967deuvhjyznpkmstqrwx', 'p0r21436x8zb9dcf5h7kjnmqesgutwvy'],
  w: ['238967debc01fg45kmstqrwxuvhjyznp', '14365h7k9dcfesgujnmqp0r2twvyx8zb'],
};
const BORDERS: Record<string, [string, string]> = {
  n: ['prxz', 'bcfguvyz'],
  s: ['028b', '0145hjnp'],
  e: ['bcfguvyz', 'prxz'],
  w: ['0145hjnp', '028b'],
};

function adjacent(hash: string, dir: 'n' | 's' | 'e' | 'w'): string {
  hash = hash.toLowerCase();
  const last = hash.slice(-1);
  const parent = hash.slice(0, -1);
  const type = hash.length % 2;
  if (BORDERS[dir][type].includes(last) && parent) return adjacent(parent, dir) + BASE32.charAt(NEIGHBORS[dir][type].indexOf(last));
  return parent + BASE32.charAt(NEIGHBORS[dir][type].indexOf(last));
}

export function geohashNeighbors(hash: string) {
  const n = adjacent(hash, 'n');
  const s = adjacent(hash, 's');
  return [hash, n, s, adjacent(hash, 'e'), adjacent(hash, 'w'), adjacent(n, 'e'), adjacent(n, 'w'), adjacent(s, 'e'), adjacent(s, 'w')].filter(Boolean);
}

export function haversineMi(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
