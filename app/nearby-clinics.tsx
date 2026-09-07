import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { liveStatus, summarizeLive, type PlacePeriod } from '@/lib/place-hours';

type Kind = 'clinic' | 'shelter';
type Clinic = {
  id: string;
  name: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  open_now?: boolean;
  hours?: string[];
  is_24h?: boolean;
  is_er?: boolean;
  status?: string;
  status_label?: string;
  minutes_to_close?: number | null;
  periods?: PlacePeriod[];
  phone?: string | null;
  website?: string | null;
};

function uber(c: Clinic) {
  if (c.lat == null || c.lng == null) return `https://m.uber.com/ul/?action=setPickup&pickup=my_location`;
  return `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${c.lat}&dropoff[longitude]=${c.lng}&dropoff[nickname]=${encodeURIComponent(c.name)}`;
}
function lyft(c: Clinic) {
  if (c.lat == null || c.lng == null) return 'https://ride.lyft.com/';
  return `https://ride.lyft.com/?destination[latitude]=${c.lat}&destination[longitude]=${c.lng}`;
}


function applyLive(list: Clinic[]) {
  const next = list.map((c) => {
    const st = liveStatus(c);
    return { ...c, status: st.code, status_label: st.label, minutes_to_close: st.minutes, open_now: st.open };
  });
  const rank: Record<string, number> = { open_24h: 0, open: 1, closing_soon: 2, unknown: 3, closed: 4 };
  next.sort((a, b) => (rank[a.status || ''] ?? 5) - (rank[b.status || ''] ?? 5));
  return next;
}

function badgeStyle(code?: string) {
  if (code === 'open_24h') return { bg: '#FEE2E2', fg: Colors.critical };
  if (code === 'open') return { bg: Colors.tealBg, fg: Colors.tealDark };
  if (code === 'closing_soon') return { bg: '#FEF3C7', fg: '#92400E' };
  return { bg: Colors.surface, fg: Colors.textTertiary };
}

export default function NearbyClinicsScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<Kind>(params.kind === 'shelter' ? 'shelter' : 'clinic');
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [meta, setMeta] = useState({ count: 0, open: 0, closing_soon: 0, er_24h: 0, source: '' });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (typeof navigator === 'undefined' || !navigator.geolocation) reject(new Error('no geo'));
          else navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000, maximumAge: 120000 });
        });
        const q = `kind=${kind}&lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`;
        const json = await fetch('/api/nearby-clinics?' + q).then((r) => r.json());
        if (cancelled) return;
        setClinics(applyLive(json.clinics || []));
        setMeta({ count: json.count || 0, open: json.open || 0, closing_soon: json.closing_soon || 0, er_24h: json.er_24h || 0, source: json.source || '' });
      } catch (e: any) {
        try {
          const json = await fetch('/api/nearby-clinics?kind=' + kind).then((r) => r.json());
          if (cancelled) return;
          setClinics(applyLive(json.clinics || []));
          setMeta({ count: json.count || 0, open: json.open || 0, closing_soon: json.closing_soon || 0, er_24h: json.er_24h || 0, source: json.source || '' });
        } catch {
          if (!cancelled) setErr(e?.message || 'Could not load places');
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [kind]);

  useEffect(() => {
    const tick = setInterval(() => {
      setClinics((cur) => {
        const next = applyLive(cur);
        const sum = summarizeLive(next);
        setMeta((m) => ({ ...m, ...sum }));
        return next;
      });
    }, 15000);
    const refetch = setInterval(() => {
      setKind((k) => k);
    }, 300000);
    return () => { clearInterval(tick); clearInterval(refetch); };
  }, []);

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <AppHeader title={kind === "shelter" ? "Nearby shelters" : "Nearby clinics"} showBack />
      <View style={styles.phone}>
        {loading ? <ActivityIndicator color={Colors.coral} style={{ marginTop: 40 }} /> : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.kindRow}>
              <TouchableOpacity style={[styles.kindBtn, kind === 'clinic' && styles.kindOn]} onPress={() => setKind('clinic')}>
                <Text style={[styles.kindTxt, kind === 'clinic' && styles.kindTxtOn]}>Clinics</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.kindBtn, kind === 'shelter' && styles.kindOn]} onPress={() => setKind('shelter')}>
                <Text style={[styles.kindTxt, kind === 'shelter' && styles.kindTxtOn]}>Shelters</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.stats}>
              <Stat n={String(meta.count)} l={kind === 'shelter' ? 'Shelters' : 'Clinics'} />
              <Stat n={String(meta.open)} l="Open" />
              <Stat n={String(meta.closing_soon)} l="Closing soon" />
              <Stat n={String(meta.er_24h)} l="24h ER" />
            </View>
            <Text style={styles.live}>LIVE · updates every 15s</Text>
            <Text style={styles.note}>Status refreshes every 15 seconds from Google hours. Closing soon = last 90 minutes. Uber/Lyft only open a ride — Rescue Army does not pay.</Text>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            {clinics.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.pills}>
                  <Text style={[styles.badge, { backgroundColor: badgeStyle(c.status).bg, color: badgeStyle(c.status).fg }]}>{c.status_label || (c.open_now ? 'Open' : 'Hours unknown')}</Text>
                  {c.is_er && c.status !== 'open_24h' ? <Text style={styles.er}>ER</Text> : null}
                </View>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.addr}>{c.address}</Text>
                {(c.hours || []).slice(0, 3).map((h) => <Text key={h} style={styles.hour}>{h}</Text>)}
                <View style={styles.row}>
                  {c.website ? (
                    <TouchableOpacity style={styles.ghost} onPress={() => Linking.openURL(c.website!)}>
                      <Text style={styles.ghostTxt}>Hours / site</Text>
                    </TouchableOpacity>
                  ) : null}
                  {c.phone ? (
                    <TouchableOpacity style={styles.ghost} onPress={() => Linking.openURL('tel:' + c.phone!.replace(/[^\d+]/g, ''))}>
                      <Text style={styles.ghostTxt}>Call</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {(c.is_er || c.is_24h) ? (
                  <View style={styles.row}>
                    <TouchableOpacity style={styles.uber} onPress={() => Linking.openURL(uber(c))}>
                      <Text style={styles.uberTxt}>Uber to ER</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.lyft} onPress={() => Linking.openURL(lyft(c))}>
                      <Text style={styles.lyftTxt}>Lyft to ER</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{l}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  phone: { flex: 1, width: '100%', width: '100%' },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: Colors.white, borderRadius: 14, padding: 12, alignItems: 'center' },
  statN: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.navy },
  statL: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
  live: { fontFamily: Fonts.extrabold, fontSize: 10, color: Colors.coral, letterSpacing: 0.8 },
  note: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 18 },
  err: { color: Colors.critical, fontFamily: Fonts.medium },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, gap: 4 },
  pills: { flexDirection: 'row', gap: 6 },
  er: { backgroundColor: Colors.criticalBg, color: Colors.critical, fontFamily: Fonts.extrabold, fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  open: { backgroundColor: Colors.tealBg, color: Colors.tealDark, fontFamily: Fonts.extrabold, fontSize: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  name: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.navy, marginTop: 4 },
  addr: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary },
  hour: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textTertiary },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  ghost: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  ghostTxt: { fontFamily: Fonts.bold, color: Colors.navy, fontSize: FontSizes.sm },
  uber: { flex: 1, backgroundColor: Colors.navy, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  uberTxt: { color: Colors.white, fontFamily: Fonts.bold },
  lyft: { flex: 1, backgroundColor: Colors.coral, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  lyftTxt: { color: Colors.white, fontFamily: Fonts.bold },
});
