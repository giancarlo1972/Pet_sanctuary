import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MapPin, PawPrint, Siren, Crosshair } from 'lucide-react-native';
import AppHeader from '@/components/AppHeader';
import NearbyMap from '@/components/NearbyMap';
import type { NearbyLayer, NearbyPin } from '@/components/NearbyMapProps';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { loadHelpFlags } from '@/lib/help-alerts';
import { geocodeMany, geocodePlace, reverseGeocode } from '@/lib/geocode';

const FALLBACK = { lat: 40.758, lng: -73.985 };
const RADII = [5, 10, 25];

const TYPE_LABEL: Record<string, string> = {
  lost: 'Lost pet', stray: 'Found stray', injured: 'Injured animal',
  road_accident: 'Road accident', cruelty: 'Cruelty/Neglect', emergency: 'Emergency',
};

const SEV_COLOR: Record<string, string> = {
  critical: Colors.critical,
  urgent: Colors.urgent,
  standard: Colors.accent,
};

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function reportTitle(r: { pet_name?: string | null; location_address?: string; report_type?: string }) {
  const place = String(r.location_address || '').replace(/^Current location.*/, '').trim();
  if (r.pet_name && place) return `${r.pet_name} — ${place}`;
  if (r.pet_name) return r.pet_name;
  if (place) return `${TYPE_LABEL[r.report_type || ''] || 'Report'} · ${place}`;
  return TYPE_LABEL[r.report_type || ''] || 'Animal report';
}

function coords(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !a) return null;
  return { lat: a, lng: b };
}

function orgPlace(o: { address?: string | null; city?: string | null; state?: string | null; location?: string | null }) {
  const cityState = [o.city, o.state].filter(Boolean).join(', ');
  if (o.address && cityState) return `${o.address}, ${cityState}`;
  if (cityState) return cityState;
  if (o.location) return String(o.location).trim();
  if (o.address) return String(o.address).trim();
  return '';
}

function orgInitial(name: string) {
  const words = String(name || '').trim().split(/\s+/).filter((w) => w && !/^(the|of|and|for|a)$/i.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const t = (words[0] || name || '?').replace(/[^A-Za-z0-9]/g, '');
  return (t.slice(0, 2) || '•').toUpperCase();
}

async function deviceLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 120000 });
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

function persistOrgCoords(id: string, loc: { lat: number; lng: number }) {
  if (!id || id.startsWith('rg-')) return;
  supabase.rpc('store_org_coords', { p_id: id, p_lat: loc.lat, p_lng: loc.lng }).then(() => {}, () => {});
}

function viewForPins(
  loc: { lat: number; lng: number },
  didLocate: boolean,
  pins: NearbyPin[],
  preferredMi: number,
) {
  const inMi = (list: NearbyPin[], c: { lat: number; lng: number }, mi: number) =>
    list.some((p) => kmBetween(c, p) <= mi * 1.609 + 0.05);
  const cover = (layer: NearbyLayer, c: { lat: number; lng: number }) => {
    const list = pins.filter((p) => p.layer === layer);
    if (!list.length) return null;
    for (const mi of [preferredMi, 10, 25]) {
      if (inMi(list, c, mi)) return Math.max(mi, preferredMi);
    }
    return null;
  };
  const hits = [cover('pets', loc), cover('clinics', loc)].filter((n): n is number => n != null);
  if (hits.length) return { center: loc, mi: Math.max(...hits) };

  const focus = pins.filter((p) => p.layer !== 'reports');
  if (!didLocate && focus.length) {
    const center = {
      lat: focus.reduce((s, p) => s + p.lat, 0) / focus.length,
      lng: focus.reduce((s, p) => s + p.lng, 0) / focus.length,
    };
    const around = [cover('pets', center), cover('clinics', center)].filter((n): n is number => n != null);
    return { center, mi: around.length ? Math.max(...around) : 25 };
  }
  return { center: loc, mi: preferredMi };
}

export default function NearbyScreen() {
  const { user } = useAuth();
  const [center, setCenter] = useState(FALLBACK);
  const [located, setLocated] = useState(false);
  const [radiusMi, setRadiusMi] = useState(5);
  const [layers, setLayers] = useState<Record<NearbyLayer, boolean>>({ reports: true, pets: true, clinics: true });
  const [pins, setPins] = useState<NearbyPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const radiusKm = radiusMi * 1.609;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const flags = user?.id ? await loadHelpFlags(user.id) : null;
      if (flags?.alert_radius_mi) setRadiusMi(flags.alert_radius_mi);
      const loc = (await deviceLocation()) || FALLBACK;
      const didLocate = !!loc && loc !== FALLBACK;
      setCenter(loc);
      setLocated(didLocate);

      const rev = didLocate ? await reverseGeocode(loc.lat, loc.lng) : null;
      const state = (rev?.stateCode || 'NY').slice(0, 2).toUpperCase();

      const orgsFull = await supabase
        .from('organizations')
        .select('id, name, org_type, city, state, address, latitude, longitude')
        .eq('status', 'approved')
        .limit(200);
      const orgsRes = orgsFull.error
        ? await supabase.from('organizations').select('id, name, org_type, city, state, address').eq('status', 'approved').limit(200)
        : orgsFull;

      const [reportsRes, petsLocal, petsRemote, rgOrgs, clinicsJson] = await Promise.all([
        supabase
          .from('reports')
          .select('id, report_type, severity, status, pet_name, location_address, description, created_at, latitude, longitude')
          .in('status', ['active', 'open'])
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('pets')
          .select('id, name, breed, species, location, main_photo_url')
          .eq('listing_type', 'adoptable')
          .eq('is_public', true)
          .order('created_at', { ascending: false })
          .limit(80),
        fetch(`/api/rescuegroups?pets=1&state=${encodeURIComponent(state)}`).then((r) => r.ok ? r.json() : { pets: [] }).catch(() => ({ pets: [] })),
        fetch(`/api/rescuegroups?state=${encodeURIComponent(state)}`).then((r) => r.ok ? r.json() : { orgs: [] }).catch(() => ({ orgs: [] })),
        fetch(`/api/nearby-clinics?kind=clinic&lat=${loc.lat}&lng=${loc.lng}`).then((r) => r.json()).catch(() => ({ clinics: [] })),
      ]);

      const localOrgs = (orgsRes.data || []) as any[];
      const remoteOrgs = ((rgOrgs.orgs || []) as any[]).filter((o) => !localOrgs.some((l) => String(l.name || '').toLowerCase() === String(o.name || '').toLowerCase()));
      const allOrgs = [...localOrgs, ...remoteOrgs];

      const seenPet = new Set<string>();
      const allPets: any[] = [];
      for (const p of [...((petsRemote.pets || []) as any[]), ...(petsLocal.data || [])]) {
        const id = String(p.id);
        if (seenPet.has(id)) continue;
        seenPet.add(id);
        allPets.push(p);
      }

      const orgQs: string[] = [];
      const petQs: string[] = [];
      for (const o of allOrgs) {
        if (coords(o.latitude ?? o.lat, o.longitude ?? o.lng)) continue;
        const q = orgPlace(o);
        if (q) orgQs.push(q);
      }
      for (const p of allPets) {
        if (coords(p.lat ?? p.latitude, p.lng ?? p.longitude)) continue;
        const q = String(p.location || '').trim();
        if (q) petQs.push(q);
      }

      const next: NearbyPin[] = [];
      const preferredMi = flags?.alert_radius_mi || 5;
      const paint = () => {
        const view = viewForPins(loc, didLocate, next, preferredMi);
        setRadiusMi(view.mi);
        setCenter(view.center);
        setPins([...next]);
        setLoading(false);
      };

      for (const r of reportsRes.data || []) {
        const c = coords(r.latitude, r.longitude);
        if (!c) continue;
        next.push({
          id: 'report-' + r.id,
          layer: 'reports',
          lat: c.lat, lng: c.lng,
          title: reportTitle(r),
          subtitle: TYPE_LABEL[r.report_type] || r.report_type,
          color: SEV_COLOR[r.severity] || Colors.accent,
          href: `/report-details?id=${r.id}`,
        });
      }

      await geocodeMany(petQs);
      const groups = new Map<string, { lat: number; lng: number; label: string; pets: any[] }>();
      for (const p of allPets) {
        let c = coords(p.lat ?? p.latitude, p.lng ?? p.longitude);
        const place = String(p.location || '').trim();
        if (!c && place) c = await geocodePlace(place);
        if (!c) continue;
        const key = place.toLowerCase() || `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`;
        const g = groups.get(key) || { lat: c.lat, lng: c.lng, label: place || 'Nearby', pets: [] };
        g.pets.push(p);
        groups.set(key, g);
      }
      for (const [key, g] of groups) {
        const n = g.pets.length;
        if (n === 1) {
          const p = g.pets[0];
          next.push({
            id: 'pet-' + p.id,
            layer: 'pets',
            lat: g.lat, lng: g.lng,
            title: p.name || 'Pet',
            subtitle: [p.breed, g.label].filter(Boolean).join(' · '),
            color: Colors.teal,
            href: `/pet-details?id=${p.id}`,
            count: 1,
          });
        } else {
          next.push({
            id: 'pets-' + key,
            layer: 'pets',
            lat: g.lat, lng: g.lng,
            title: `${n} adoptable pets`,
            subtitle: g.label,
            color: Colors.teal,
            href: '/pets',
            count: n,
          });
        }
      }
      paint();

      await geocodeMany(orgQs);
      for (const o of allOrgs) {
        let c = coords(o.latitude ?? o.lat, o.longitude ?? o.lng);
        const q = orgPlace(o);
        if (!c && q) c = await geocodePlace(q);
        if (!c) continue;
        if (!coords(o.latitude ?? o.lat, o.longitude ?? o.lng) && q) persistOrgCoords(String(o.id), c);
        const place = [o.city, o.state].filter(Boolean).join(', ') || o.location || o.address || '';
        next.push({
          id: 'org-' + o.id,
          layer: 'clinics',
          lat: c.lat, lng: c.lng,
          title: o.name || 'Organization',
          subtitle: [o.org_type, place].filter(Boolean).join(' · '),
          color: Colors.navy,
          href: `/organization-details?id=${o.id}`,
          initial: orgInitial(o.name || ''),
        });
      }

      for (const c of clinicsJson.clinics || []) {
        const locC = coords(c.lat, c.lng);
        if (!locC) continue;
        next.push({
          id: 'clinic-' + c.id,
          layer: 'clinics',
          lat: locC.lat, lng: locC.lng,
          title: c.name,
          subtitle: c.status_label || c.address || (c.is_er ? 'ER' : 'Clinic'),
          color: c.is_er || c.is_24h ? Colors.coral : Colors.navy,
          href: c.maps_url || c.website || `https://www.google.com/maps/search/?api=1&query=${locC.lat},${locC.lng}`,
          initial: orgInitial(c.name || 'Vet'),
        });
      }
      paint();
    } catch {
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    return pins.filter((p) => {
      if (!layers[p.layer]) return false;
      return kmBetween(center, p) <= radiusKm + 0.05;
    });
  }, [pins, layers, center, radiusKm]);

  const onSelect = (pin: NearbyPin) => {
    setSelectedId(pin.id);
    if (pin.href.startsWith('http')) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(pin.href, '_blank');
      else Linking.openURL(pin.href);
      return;
    }
    router.push(pin.href as any);
  };

  const toggle = (key: NearbyLayer) => setLayers((s) => ({ ...s, [key]: !s[key] }));

  const counts = {
    reports: visible.filter((p) => p.layer === 'reports').length,
    pets: visible.reduce((s, p) => s + (p.layer === 'pets' ? (p.count || 1) : 0), 0),
    clinics: visible.filter((p) => p.layer === 'clinics').length,
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader title="Nearby" />
      <View style={styles.stage}>
        <NearbyMap
          center={center}
          radiusKm={radiusKm}
          pins={visible}
          selectedId={selectedId}
          onSelect={onSelect}
        />
        <View style={styles.chips} pointerEvents="box-none">
          <View style={styles.chipRow}>
            {([
              { key: 'reports' as const, label: 'Reports', icon: Siren, n: counts.reports },
              { key: 'pets' as const, label: 'Adoptable pets', icon: PawPrint, n: counts.pets },
              { key: 'clinics' as const, label: 'Shelters & clinics', icon: MapPin, n: counts.clinics },
            ]).map((c) => {
              const on = layers[c.key];
              const Icon = c.icon;
              return (
                <TouchableOpacity key={c.key} style={[styles.chip, on && styles.chipOn]} onPress={() => toggle(c.key)} activeOpacity={0.85}>
                  <Icon size={14} color={on ? Colors.white : Colors.navy} />
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{c.label} {c.n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.chipRow}>
            {RADII.map((mi) => (
              <TouchableOpacity key={mi} style={[styles.rChip, radiusMi === mi && styles.rChipOn]} onPress={() => setRadiusMi(mi)} activeOpacity={0.85}>
                <Text style={[styles.rTxt, radiusMi === mi && styles.rTxtOn]}>{mi} mi</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.rChip} onPress={load} activeOpacity={0.85}>
              <Crosshair size={13} color={Colors.navy} />
              <Text style={styles.rTxt}>{located ? 'My location' : 'Locate'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>
            {loading ? 'Finding what’s around you' : `${visible.length} within ${radiusMi} mi`}
          </Text>
          {loading ? (
            <ActivityIndicator color={Colors.coral} style={{ marginTop: 12 }} />
          ) : (
            <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
              {visible.length === 0 ? (
                <Text style={styles.empty}>Nothing in this radius yet. Widen the range or turn on another layer.</Text>
              ) : visible.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.row, selectedId === p.id && styles.rowOn]}
                  onPress={() => onSelect(p)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.badge, { backgroundColor: p.color }]}>
                    <Text style={styles.badgeTxt}>{p.count != null ? p.count : (p.initial || '•')}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{p.title}</Text>
                    {p.subtitle ? <Text style={styles.rowSub} numberOfLines={1}>{p.subtitle}</Text> : null}
                  </View>
                  <Text style={styles.ago}>{kmBetween(center, p).toFixed(1)} km</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.screen },
  stage: { flex: 1, position: 'relative' },
  chips: { position: 'absolute', top: 10, left: 12, right: 12, gap: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E8EAF0',
  },
  chipOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.navy },
  chipTxtOn: { color: Colors.white },
  rChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#E8EAF0',
  },
  rChipOn: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  rTxt: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.navy },
  rTxtOn: { color: Colors.white },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    maxHeight: '42%',
    borderTopWidth: 1, borderColor: Colors.border,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#D9DCE6', marginBottom: 8 },
  sheetTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.navy, marginBottom: 8 },
  sheetList: { flexGrow: 0 },
  empty: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowOn: { backgroundColor: Colors.surface },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontFamily: Fonts.bold, fontSize: 10, color: Colors.white },
  rowTitle: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy },
  rowSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  ago: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textTertiary },
});
