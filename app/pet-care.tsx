import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { GINA } from '@/lib/gina-record';

type Tab = 'overview' | 'insurance' | 'medical' | 'invoices';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'medical', label: 'Medical' },
  { id: 'invoices', label: 'Invoices' },
];

export default function PetCareScreen() {
  const { petId } = useLocalSearchParams<{ petId?: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [name, setName] = useState(GINA.name);
  const [photo, setPhoto] = useState(GINA.photo);
  const [subtitle, setSubtitle] = useState(GINA.subtitle);

  useEffect(() => {
    if (!petId) return;
    supabase
      .from('pets')
      .select('name, breed, species, gender, main_photo_url, spayed_neutered, weight_kg')
      .eq('id', petId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        if (data.name) setName(data.name);
        if (data.main_photo_url && String(data.main_photo_url).startsWith('http')) setPhoto(data.main_photo_url);
        const bits = [data.breed, data.species, data.gender, data.spayed_neutered ? 'Spayed/Neutered' : null].filter(Boolean);
        if (bits.length) setSubtitle(bits.join(' · '));
      });
  }, [petId]);

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <AppHeader title={name} showBack />
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.id} style={[styles.tab, tab === t.id && styles.tabOn]} onPress={() => setTab(t.id)}>
            <Text style={[styles.tabTxt, tab === t.id && styles.tabTxtOn]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {tab === 'overview' && <Overview name={name} photo={photo} subtitle={subtitle} />}
        {tab === 'insurance' && <Insurance />}
        {tab === 'medical' && <Medical />}
        {tab === 'invoices' && <Invoices />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Overview({ name, photo, subtitle }: { name: string; photo: string; subtitle: string }) {
  return (
    <>
      <Image source={{ uri: photo }} style={styles.hero} resizeMode="cover" />
      <Text style={styles.h1}>{name}</Text>
      <Text style={styles.sub}>{subtitle}</Text>
      <View style={styles.chipRow}>
        {GINA.chips.map((c) => (
          <View key={c} style={styles.chip}><Text style={styles.chipTxt}>{c}</Text></View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.kicker}>WEIGHT · MICROCHIP</Text>
        <Text style={styles.stat}>{GINA.weightLb}</Text>
        <Text style={styles.body}>Chip {GINA.chip} · AAHA lookup is on the pet record.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.kicker}>SIIPET · {GINA.device.name}</Text>
        <Text style={styles.body}>{GINA.device.detail}</Text>
        {GINA.device.stats.map((s) => (
          <View key={s.label} style={styles.row}>
            <Text style={styles.rowL}>{s.label}</Text>
            <Text style={styles.rowR}>{s.value}</Text>
          </View>
        ))}
        {GINA.device.events.map((e) => (
          <Text key={e.at} style={styles.event}>{e.at} · {e.kind} · {e.note}</Text>
        ))}
        <TouchableOpacity style={styles.btnGhost} onPress={() => Linking.openURL(GINA.device.shopUrl)}>
          <Text style={styles.btnGhostTxt}>SiiPet LitterLens (partner access pending)</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.note}>
        <Text style={styles.body}>{GINA.aiNote}</Text>
      </View>
    </>
  );
}

function Insurance() {
  const i = GINA.insurance;
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.kicker}>CARRIER</Text>
        <Text style={styles.h1}>{i.carrier}</Text>
        <Text style={styles.sub}>{i.plan}</Text>
        <Text style={styles.body}>{i.policy}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => Linking.openURL(i.fileClaimUrl)}>
          <Text style={styles.btnTxt}>File / track claim in Lemonade</Text>
        </TouchableOpacity>
      </View>
      {i.claims.map((c) => (
        <View key={c.title} style={styles.card}>
          <Text style={styles.rowR}>{c.amount}</Text>
          <Text style={styles.h2}>{c.title}</Text>
          <Text style={styles.body}>{c.meta}</Text>
        </View>
      ))}
    </>
  );
}

function Medical() {
  return (
    <>
      <Text style={styles.section}>Vaccines</Text>
      {GINA.vaccines.map((v) => (
        <View key={v.name} style={styles.card}>
          <Text style={styles.h2}>{v.name}</Text>
          <Text style={styles.ok}>{v.valid}</Text>
          <Text style={styles.body}>Given {v.given}</Text>
          <Text style={styles.body}>Next {v.next}</Text>
        </View>
      ))}
      <Text style={styles.section}>Labs</Text>
      {GINA.labs.map((l) => (
        <View key={l.name} style={styles.card}>
          <Text style={styles.h2}>{l.name}</Text>
          <Text style={styles.ok}>{l.result}</Text>
          <Text style={styles.body}>{l.date}</Text>
        </View>
      ))}
    </>
  );
}

function Invoices() {
  return (
    <>
      <Text style={styles.body}>Owner invoices. Rescue Army stores the receipt line — payment stays with the clinic / Lemonade.</Text>
      {GINA.invoices.map((inv) => (
        <View key={inv.desc} style={styles.card}>
          <Text style={styles.rowR}>{inv.amount}</Text>
          <Text style={styles.h2}>{inv.vendor}</Text>
          <Text style={styles.body}>{inv.desc}</Text>
          <Text style={styles.body}>{inv.date} · {inv.status}</Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  tabs: { flexDirection: 'row', margin: 12, backgroundColor: Colors.surface, borderRadius: 999, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  tabOn: { backgroundColor: Colors.navy },
  tabTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.textSecondary },
  tabTxtOn: { color: Colors.white },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  hero: { width: '100%', height: 220, borderRadius: 16, backgroundColor: Colors.surface },
  h1: { fontFamily: Fonts.extrabold, fontSize: FontSizes.xl, color: Colors.navy },
  h2: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.navy, marginTop: 4 },
  sub: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 10, color: Colors.coral, letterSpacing: 0.8 },
  section: { fontFamily: Fonts.extrabold, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.8, marginTop: 8 },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: 6 },
  stat: { fontFamily: Fonts.extrabold, fontSize: 28, color: Colors.navy, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: Colors.tealBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipTxt: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.tealDark },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  rowL: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSizes.sm },
  rowR: { fontFamily: Fonts.extrabold, color: Colors.navy, fontSize: FontSizes.md },
  event: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, color: Colors.textTertiary, marginTop: 6 },
  ok: { fontFamily: Fonts.bold, color: Colors.tealDark, marginTop: 4 },
  btn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  btnTxt: { color: Colors.white, fontFamily: Fonts.bold },
  btnGhost: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnGhostTxt: { fontFamily: Fonts.bold, color: Colors.navy, fontSize: FontSizes.sm },
  note: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
});
