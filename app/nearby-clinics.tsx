import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '@/components/AppHeader';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

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

export default function NearbyClinicsScreen() {
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [meta, setMeta] = useState({ count: 0, open_now: 0, er_24h: 0, source: '' });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (typeof navigator === 'undefined' || !navigator.geolocation) reject(new Error('no geo'));
          else navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 12000, maximumAge: 120000 });
        });
        const q = `lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`;
        const json = await fetch('/api/nearby-clinics?' + q).then((r) => r.json());
        setClinics(json.clinics || []);
        setMeta({ count: json.count || 0, open_now: json.open_now || 0, er_24h: json.er_24h || 0, source: json.source || '' });
      } catch (e: any) {
        try {
          const json = await fetch('/api/nearby-clinics').then((r) => r.json());
          setClinics(json.clinics || []);
          setMeta({ count: json.count || 0, open_now: json.open_now || 0, er_24h: json.er_24h || 0, source: json.source || '' });
        } catch {
          setErr(e?.message || 'Could not load clinics');
        }
      }
      setLoading(false);
    })();
  }, []);

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <AppHeader title="Nearby clinics" showBack />
      <View style={styles.phone}>
        {loading ? <ActivityIndicator color={Colors.coral} style={{ marginTop: 40 }} /> : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.stats}>
              <Stat n={String(meta.count)} l="Clinics" />
              <Stat n={String(meta.open_now)} l="Open now" />
              <Stat n={String(meta.er_24h)} l="24h / ER" />
            </View>
            <Text style={styles.note}>Hours come from Google / the clinic site (Bond Vet, Small Door post theirs). Rescue Army does not book the appointment and does not pay Uber or Lyft — we only open the ride.</Text>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            {clinics.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.pills}>
                  {c.is_24h || c.is_er ? <Text style={styles.er}>24h ER</Text> : null}
                  {c.open_now ? <Text style={styles.open}>Open now</Text> : null}
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
  phone: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center' },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: Colors.white, borderRadius: 14, padding: 12, alignItems: 'center' },
  statN: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.navy },
  statL: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textSecondary, marginTop: 4 },
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
