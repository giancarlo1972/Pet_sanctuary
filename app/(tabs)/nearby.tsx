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
      setCenter(loc);
      setLocated(!!loc && loc !== FALLBACK);

      const q = `lat=${loc.lat}&lng=${loc.lng}`;
      const [reportsRes, petsLocal, petsRemote, clinicsJson, sheltersJson] = await Promise.all([
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
          .limit(40),
        fetch('/api/rescuegroups?pets=1&state=NY').then((r) => r.ok ? r.json() : { pets: [] }).catch(() => ({ pets: [] })),
        fetch('/api/nearby-clinics?kind=clinic&' + q).then((r) => r.json()).catch(() => ({ clinics: [] })),
        fetch('/api/nearby-clinics?kind=shelter&' + q).then((r) => r.json()).catch(() => ({ clinics: [] })),
      ]);

      const next: NearbyPin[] = [];

      for (const r of reportsRes.data || []) {
        const lat = Number(r.latitude);
        const lng = Number(r.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        next.push({
          id: 'report-' + r.id,
          layer: 'reports',
          lat, lng,
          title: reportTitle(r),
          subtitle: TYPE_LABEL[r.report_type] || r.report_type,
          color: SEV_COLOR[r.severity] || Colors.accent,
          href: `/report-details?id=${r.id}`,
        });
      }

      const remotePets = (petsRemote.pets || []) as any[];
      const seen = new Set<string>();
      for (const p of remotePets) {
        const lat = Number(p.lat);
        const lng = Number(p.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !lat) continue;
        seen.add(p.id);
        next.push({
          id: 'pet-' + p.id,
          layer: 'pets',
          lat, lng,
          title: p.name || 'Pet',
          subtitle: [p.breed, p.location].filter(Boolean).join(' · '),
          color: Colors.teal,
          href: `/pet-details?id=${p.id}`,
        });
      }
      for (const p of petsLocal.data || []) {
        if (seen.has(p.id)) continue;
        const lat = Number((p as any).lat ?? (p as any).latitude);
        const lng = Number((p as any).lng ?? (p as any).longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || !lat) continue;
        next.push({
          id: 'pet-' + p.id,
          layer: 'pets',
          lat, lng,
          title: p.name || 'Pet',
          subtitle: [p.breed, p.location].filter(Boolean).join(' · '),
          color: Colors.teal,
          href: `/pet-details?id=${p.id}`,
        });
      }

      for (const c of [...(clinicsJson.clinics || []), ...(sheltersJson.clinics || [])]) {
        const lat = Number(c.lat);
        const lng = Number(c.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        next.push({
          id: 'clinic-' + c.id,
          layer: 'clinics',
          lat, lng,
          title: c.name,
          subtitle: c.status_label || c.address || (c.is_er ? 'ER' : 'Clinic'),
          color: c.is_er || c.is_24h ? Colors.coral : Colors.navy,
          href: c.maps_url || c.website || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
        });
      }

      setPins(next);
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
    pets: visible.filter((p) => p.layer === 'pets').length,
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
              { key: 'pets' as const, label: 'Pets', icon: PawPrint, n: counts.pets },
              { key: 'clinics' as const, label: 'Clinics', icon: MapPin, n: counts.clinics },
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
                  <View style={[styles.dot, { backgroundColor: p.color }]} />
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
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowTitle: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy },
  rowSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  ago: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textTertiary },
});
