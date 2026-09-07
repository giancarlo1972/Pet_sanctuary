import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import SignedImage from '@/components/SignedImage';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { prepareImageFile } from '@/lib/prepare-image';

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
  const [pet, setPet] = useState<any>(null);
  const [weight, setWeight] = useState<{ weight_lb: number; measured_on: string } | null>(null);
  const [chip, setChip] = useState<string | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!petId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('pets')
      .select('id, name, breed, species, gender, main_photo_url, spayed_neutered, vaccinated, microchipped, weight_kg')
      .eq('id', petId)
      .maybeSingle();
    setPet(data);
    const { data: w } = await supabase.from('weight_entries').select('weight_lb, measured_on').eq('pet_id', petId).order('measured_on', { ascending: false }).limit(1).maybeSingle();
    if (w) setWeight(w);
    else if (data?.weight_kg) setWeight({ weight_lb: Math.round(Number(data.weight_kg) * 2.20462 * 10) / 10, measured_on: '' });
    else setWeight(null);
    const chipVal = null;
    setChip(chipVal || null);
    const { data: ids } = await supabase.from('pet_identifiers').select('value, kind').eq('pet_id', petId);
    const micro = (ids || []).find((i: any) => /chip/i.test(i.kind || ''))?.value;
    if (micro) setChip(micro);
    const { data: dev } = await supabase.from('pet_devices').select('id, vendor, name').eq('pet_id', petId);
    setDevices(dev || []);
    const { data: rd } = await supabase.from('device_readings').select('id, kind, value, unit, recorded_at, note').eq('pet_id', petId).order('recorded_at', { ascending: false }).limit(8);
    setReadings(rd || []);
    setLoading(false);
  }, [petId]);

  useEffect(() => { load(); }, [load]);

  const name = pet?.name || 'Pet';
  const subtitle = [pet?.breed, pet?.species, pet?.gender, pet?.spayed_neutered ? 'Spayed/Neutered' : null].filter(Boolean).join(' · ');
  const chips = [
    pet?.vaccinated ? 'Vaccinated' : null,
    pet?.spayed_neutered ? 'Spayed/Neutered' : null,
    pet?.microchipped || chip ? 'Microchipped' : null,
  ].filter(Boolean) as string[];

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <AppHeader title={name} showBack />
      <View style={styles.phone}>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.tab, tab === t.id && styles.tabOn]} onPress={() => setTab(t.id)}>
              <Text style={[styles.tabTxt, tab === t.id && styles.tabTxtOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {loading ? <ActivityIndicator color={Colors.navy} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {tab === 'overview' && (
            <Overview name={name} photo={pet?.main_photo_url} subtitle={subtitle} chips={chips} weight={weight} chip={chip} devices={devices} readings={readings} />
          )}
          {tab === 'insurance' && <Insurance />}
          {tab === 'medical' && <Medical petId={petId} />}
          {tab === 'invoices' && <Invoices />}
        </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function Overview({ name, photo, subtitle, chips, weight, chip, devices, readings }: any) {
  return (
    <>
      <View style={styles.heroBox}>
        {photo ? (
          String(photo).startsWith('http')
            ? <Image source={{ uri: photo }} style={styles.hero} resizeMode="contain" />
            : <SignedImage path={photo} style={styles.hero} />
        ) : (
          <Text style={styles.sub}>No photo</Text>
        )}
      </View>
      <Text style={styles.h1}>{name}</Text>
      <Text style={styles.sub}>{subtitle || 'No breed/species on file'}</Text>
      {chips.length ? (
        <View style={styles.chipRow}>
          {chips.map((c: string) => (
            <View key={c} style={styles.chip}><Text style={styles.chipTxt}>{c}</Text></View>
          ))}
        </View>
      ) : null}
      <View style={styles.card}>
        <Text style={styles.kicker}>WEIGHT · MICROCHIP</Text>
        <Text style={styles.stat}>{weight ? `${weight.weight_lb} lb` : 'No weight recorded'}</Text>
        <Text style={styles.body}>{chip ? `Chip ${chip}` : 'No microchip on file'}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.kicker}>DEVICES</Text>
        {devices.length === 0 ? (
          <Text style={styles.body}>No device connected</Text>
        ) : devices.map((d: any) => (
          <Text key={d.id} style={styles.h2}>{d.vendor} · {d.name}</Text>
        ))}
        {readings.map((e: any) => (
          <Text key={e.id} style={styles.event}>{e.recorded_at} · {e.kind} · {e.value}{e.unit || ''} {e.note || ''}</Text>
        ))}
      </View>
    </>
  );
}

function Insurance() {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>INSURANCE</Text>
      <Text style={styles.h2}>No policy on file</Text>
      <Text style={styles.body}>When a carrier is linked, claims stay in their app. Rescue Army does not store card or login data.</Text>
    </View>
  );
}

function Medical({ petId }: { petId?: string }) {
  const [hub, setHub] = useState<'records' | 'labs' | 'history' | 'ai'>('records');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<any>(null);
  const [findings, setFindings] = useState<any>(null);
  const [vax, setVax] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [weights, setWeights] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!petId) return;
    const [{ data: v }, { data: l }, { data: w }] = await Promise.all([
      supabase.from('pet_vaccinations').select('id, vaccine, brand, dose, administered_on, next_due_on, confirmed, source').eq('pet_id', petId).order('administered_on', { ascending: false }),
      supabase.from('lab_results').select('id, name, value, unit, flag, collected_on, confirmed, source').eq('pet_id', petId).order('collected_on', { ascending: false }),
      supabase.from('weight_entries').select('id, weight_lb, measured_on').eq('pet_id', petId).order('measured_on', { ascending: false }).limit(12),
    ]);
    setVax(v || []); setLabs(l || []); setWeights(w || []);
  }, [petId]);
  useEffect(() => { load(); }, [load]);

  const uploadDoc = () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !petId) return;
      setBusy(true); setMsg(null);
      try {
        const prepared = file.type.startsWith('image/')
          ? await prepareImageFile(file)
          : { blob: file, dataUrl: await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file); }), mediaType: file.type };
        const path = `${petId}/${Date.now()}.jpg`;
        await supabase.storage.from('pet-documents').upload(path, prepared.blob, { contentType: prepared.mediaType || 'image/jpeg', upsert: true });
        const res = await fetch('/api/parse-pet-document', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: prepared.dataUrl }) });
        const json = await res.json();
        await supabase.from('pet_documents').insert({ pet_id: petId, kind: json.kind || 'other', storage_path: path, extracted: json, confirmed: false });
        setPending(json);
        if (!json.parsed) setMsg(json.error || 'Could not read document.');
      } catch (e: any) {
        setMsg(e.message || 'Upload failed.');
      }
      setBusy(false);
    };
    input.click();
  };

  const confirmExtract = async () => {
    if (!pending || !petId) return;
    setBusy(true);
    for (const v of pending.vaccinations || []) {
      await supabase.from('pet_vaccinations').insert({
        pet_id: petId, vaccine: v.name || v.brand, brand: v.brand, dose: v.dose,
        administered_on: v.given_on || null, next_due_on: v.expires_on || null,
        confirmed: true, source: 'ai_extracted',
      });
    }
    for (const l of pending.labs || []) {
      await supabase.from('lab_results').insert({
        pet_id: petId, name: l.name, value: l.value, unit: l.unit, flag: l.flag,
        confirmed: true, source: 'ai_extracted',
      });
    }
    setPending(null); setBusy(false); load();
  };

  const runAi = async () => {
    if (!petId) return;
    setBusy(true); setMsg(null);
    const res = await fetch('/api/pet-health-analysis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record: { vaccines: vax, labs, weights } }),
    });
    const json = await res.json();
    setFindings(json);
    if (json.ok) {
      await supabase.from('ai_health_analyses').insert({
        pet_id: petId, findings: json.findings, summary: json.summary, disclaimer: json.disclaimer,
      });
    }
    setBusy(false);
  };

  const HUBS = [['records', 'Records'], ['labs', 'Labs'], ['history', 'History'], ['ai', 'AI Health']] as const;
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.kicker}>HEALTH SUMMARY</Text>
        <Text style={styles.h2}>Records · Labs · History · AI Health</Text>
        <Text style={styles.body}>AI extracts data. You confirm. A veterinarian decides treatment.</Text>
        <TouchableOpacity style={styles.btn} onPress={uploadDoc} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTxt}>Upload vaccine / lab / invoice</Text>}
        </TouchableOpacity>
      </View>
      {msg ? <Text style={styles.body}>{msg}</Text> : null}
      {pending ? (
        <View style={styles.card}>
          <Text style={styles.kicker}>AI EXTRACTED · UNCONFIRMED</Text>
          <Text style={styles.body}>{pending.labeled || 'Review before saving.'}</Text>
          {(pending.vaccinations || []).map((v: any, i: number) => <Text key={i} style={styles.body}>Vaccine: {v.brand || v.name} {v.dose}</Text>)}
          {(pending.labs || []).map((l: any, i: number) => <Text key={i} style={styles.body}>Lab: {l.name} {l.value} {l.unit}</Text>)}
          <TouchableOpacity style={styles.btn} onPress={confirmExtract}><Text style={styles.btnTxt}>Confirm into record</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btnGhost} onPress={() => setPending(null)}><Text style={styles.btnGhostTxt}>Discard</Text></TouchableOpacity>
        </View>
      ) : null}
      <View style={styles.tabs}>
        {HUBS.map(([id, label]) => (
          <TouchableOpacity key={id} style={[styles.tab, hub === id && styles.tabOn]} onPress={() => setHub(id)}>
            <Text style={[styles.tabTxt, hub === id && styles.tabTxtOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {hub === 'records' && (vax.length ? vax.map((v) => (
        <View key={v.id} style={styles.card}>
          <Text style={styles.h2}>{v.brand || v.vaccine}</Text>
          <Text style={styles.ok}>{v.source === 'ai_extracted' && !v.confirmed ? 'Unconfirmed AI' : 'On file'}</Text>
          <Text style={styles.body}>Given {v.administered_on || '—'} · Next {v.next_due_on || '—'}</Text>
        </View>
      )) : <View style={styles.card}><Text style={styles.body}>No vaccine records yet.</Text></View>)}
      {hub === 'labs' && (labs.length ? labs.map((l) => (
        <View key={l.id} style={styles.card}>
          <Text style={styles.h2}>{l.name}</Text>
          <Text style={styles.ok}>{l.value} {l.unit} · {l.flag || ''}</Text>
        </View>
      )) : <View style={styles.card}><Text style={styles.body}>No lab results yet.</Text></View>)}
      {hub === 'history' && (
        weights.length
          ? weights.map((w) => (
            <View key={w.id} style={styles.card}><Text style={styles.h2}>{w.weight_lb} lb</Text><Text style={styles.body}>{w.measured_on}</Text></View>
          ))
          : <View style={styles.card}><Text style={styles.body}>No weight recorded</Text></View>
      )}
      {hub === 'ai' && (
        <View style={styles.warn}>
          <Text style={styles.warnTitle}>AI is not a veterinarian</Text>
          <Text style={styles.body}>Findings are for the vet. No diagnosis. No treatment plan from Rescue Army.</Text>
          <TouchableOpacity style={styles.btn} onPress={runAi} disabled={busy}>
            <Text style={styles.btnTxt}>{busy ? 'Analyzing…' : 'Run AI Health'}</Text>
          </TouchableOpacity>
          {findings?.summary ? <Text style={styles.h2}>{findings.summary}</Text> : null}
          {(findings?.findings || []).map((f: any, i: number) => (
            <Text key={i} style={styles.body}>{f.severity}: {f.title} — {f.detail}</Text>
          ))}
          {findings?.disclaimer ? <Text style={styles.body}>{findings.disclaimer}</Text> : null}
        </View>
      )}
    </>
  );
}

function Invoices() {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>INVOICES</Text>
      <Text style={styles.h2}>None on this pet yet</Text>
      <Text style={styles.body}>The invoice belongs to the pet. Payment stays with the clinic, insurer, or pharmacy — never Rescue Army.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  phone: { flex: 1, width: '100%', maxWidth: 880, alignSelf: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: 12, marginTop: 8, backgroundColor: Colors.surface, borderRadius: 999, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  tabOn: { backgroundColor: Colors.navy },
  tabTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.textSecondary },
  tabTxtOn: { color: Colors.white },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  heroBox: {
    width: '100%', height: 320, borderRadius: 16, backgroundColor: Colors.navy,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  hero: { width: '100%', height: '100%' },
  h1: { fontFamily: Fonts.extrabold, fontSize: FontSizes.xl, color: Colors.navy },
  h2: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.navy, marginTop: 4 },
  sub: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 10, color: Colors.coral, letterSpacing: 0.8 },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: 6 },
  stat: { fontFamily: Fonts.extrabold, fontSize: 28, color: Colors.navy, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: Colors.tealBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipTxt: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.tealDark },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  event: { fontFamily: Fonts.regular, fontSize: FontSizes.xs, color: Colors.textTertiary, marginTop: 6 },
  ok: { fontFamily: Fonts.bold, color: Colors.tealDark, marginTop: 4 },
  btn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  btnTxt: { color: Colors.white, fontFamily: Fonts.bold },
  btnGhost: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnGhostTxt: { fontFamily: Fonts.bold, color: Colors.navy, fontSize: FontSizes.sm },
  warn: { backgroundColor: Colors.criticalBg, borderRadius: 14, padding: 14, gap: 8 },
  warnTitle: { fontFamily: Fonts.extrabold, color: Colors.critical, fontSize: FontSizes.md },
});
