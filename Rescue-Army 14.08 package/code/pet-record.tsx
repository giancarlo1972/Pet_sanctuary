// app/pet-record.tsx — Pet record v2 (matches prototype: Overview / Insurance / Medical hub → Records · Labs · History · AI Health)
// Replaces the old Overview/Health/Documents/History screen. Requires pet_record_v2.sql + the two Edge Functions.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, Alert, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import AppHeader from '@/components/AppHeader';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';

type Tab = 'Overview' | 'Insurance' | 'Medical';
type MedTab = 'Records' | 'Labs' | 'History' | 'AI Health';
const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const daysUntil = (d?: string | null) => d ? Math.round((new Date(d).getTime() - Date.now()) / 864e5) : null;

export default function PetRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [tab, setTab] = useState<Tab>('Overview');
  const [med, setMed] = useState<MedTab>('Records');
  const [pet, setPet] = useState<any>(null);
  const [vax, setVax] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [weights, setWeights] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [chip, setChip] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [p, v, l, w, h, d, a, c] = await Promise.all([
      supabase.from('pets').select('*').eq('id', id).single(),
      supabase.from('vaccinations').select('*').eq('pet_id', id).order('given_on', { ascending: false }),
      supabase.from('lab_results').select('*').eq('pet_id', id).order('taken_on', { ascending: false }),
      supabase.from('weight_entries').select('*').eq('pet_id', id).order('recorded_at'),
      supabase.from('medical_records').select('*').eq('pet_id', id).order('record_date', { ascending: false }),
      supabase.from('pet_documents').select('*').eq('pet_id', id).order('created_at', { ascending: false }),
      supabase.from('ai_health_analyses').select('*').eq('pet_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('pet_identifiers').select('microchip_number').eq('pet_id', id).maybeSingle(), // RLS decides visibility
    ]);
    setPet(p.data); setVax(v.data ?? []); setLabs(l.data ?? []); setWeights(w.data ?? []);
    setHistory(h.data ?? []); setDocs(d.data ?? []); setAnalysis(a.data ?? null); setChip(c.data?.microchip_number ?? null);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // ---- actions --------------------------------------------------------------
  const uploadDocument = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
    if (res.canceled) return;
    setBusy('upload');
    const f = res.assets[0];
    const path = `${id}/${Date.now()}-${f.name}`;
    const blob = await (await fetch(f.uri)).blob();
    const up = await supabase.storage.from('pet-documents').upload(path, blob, { contentType: f.mimeType });
    if (up.error) { Alert.alert('Upload failed', up.error.message); setBusy(null); return; }
    const { data: doc } = await supabase.from('pet_documents').insert({ pet_id: id, kind: 'other', storage_path: path, title: f.name, uploaded_by: user?.id }).select().single();
    await supabase.functions.invoke('parse-pet-document', { body: { document_id: doc!.id } });
    setBusy(null); load(); setTab('Medical'); setMed('Records');
  };
  const confirmRow = async (table: 'vaccinations' | 'lab_results', rowId: string) => {
    await supabase.from(table).update({ confirmed: true }).eq('id', rowId); load();
  };
  const runAnalysis = async () => {
    setBusy('ai');
    const { data, error } = await supabase.functions.invoke('pet-health-analysis', { body: { pet_id: id } });
    if (error) Alert.alert('Analysis failed', error.message); else setAnalysis(data);
    setBusy(null);
  };
  const shareWithVet = async () => {
    if (!analysis) return;
    await supabase.from('ai_health_analyses').update({ shared_with_vet_at: new Date().toISOString() }).eq('id', analysis.id);
    setAnalysis({ ...analysis, shared_with_vet_at: new Date().toISOString() });
  };

  // ---- derived --------------------------------------------------------------
  const latestW = weights.at(-1)?.weight_lb ?? pet?.weight_lb;
  const target = pet?.target_weight_lb;
  const pct = latestW && target ? Math.max(0, Math.min(100, Math.round(100 - ((latestW - target) / Math.max(latestW, 1)) * 100))) : null;
  const visitsThisYear = useMemo(() => history.filter((h) => new Date(h.record_date).getFullYear() === new Date().getFullYear() && ['visit', 'exam', 'surgery'].includes(h.record_type)).length, [history]);
  const conditions = useMemo(() => history.filter((h) => h.record_type === 'condition'), [history]);
  const pendingAi = [...vax.filter((v) => !v.confirmed), ...labs.filter((l) => !l.confirmed)];

  if (loading || !pet) return <SafeAreaView style={s.wrap}><AppHeader title="Pet record" showBack /><ActivityIndicator color={Colors.coral} style={{ marginTop: 40 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.wrap} edges={['top']}>
      <AppHeader title={pet.name} showBack />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={[s.col, wide && { maxWidth: 880 }]}>
          {/* header */}
          <View style={s.head}>
            {pet.main_photo_url ? <Image source={{ uri: pet.main_photo_url }} style={s.avatar} /> : <View style={[s.avatar, s.avatarEmpty]}><Text style={s.avatarTxt}>{pet.name[0]}</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{pet.name}</Text>
              <Text style={s.sub}>{pet.breed} · {pet.gender} · {pet.spayed_neutered ? 'Spayed/Neutered' : 'Intact'}</Text>
            </View>
            <Text style={s.ownPill}>{pet.owner_id === user?.id ? 'I OWN' : 'VIEWING'}</Text>
          </View>

          {/* top tabs */}
          <Pills items={['Overview', 'Insurance', 'Medical']} active={tab} onPick={(t) => setTab(t as Tab)} />

          {tab === 'Overview' && (
            <>
              <View style={s.chips}>
                {pet.spayed_neutered ? <Chip teal>Spayed/Neutered</Chip> : null}
                {chip ? <Chip teal>Microchipped</Chip> : null}
                <Chip teal>{`Vaccines (${vax.filter((v) => v.confirmed).length})`}</Chip>
                {latestW ? <Chip>{`${latestW} lb`}</Chip> : null}
              </View>
              <Card title="MICROCHIP">
                <Text style={s.mono}>{chip ?? '•••• request access'}</Text>
                <Text style={s.help}>Visible to you and verified org staff only. Fosters must request access. Storing it here doesn't register the chip — verify at the AAHA universal lookup after a move.</Text>
              </Card>
              <View style={s.table}>
                <Row k="Breed" v={pet.breed} badge={pet.ai_traits?.confidence ? `AI · ${Math.round(pet.ai_traits.confidence * 100)}%` : undefined} />
                <Row k="Color" v={(pet.colors ?? []).join(' / ') || '—'} swatches={pet.colors} />
                <Row k="Weight" v={latestW ? `${latestW} lb${target ? ` · target ${target} lb` : ''}` : '—'} />
                <Row k="Owner since" v={fmt(pet.created_at)} last />
              </View>
            </>
          )}

          {tab === 'Insurance' && (
            <Card title="PET INSURANCE" dark>
              <Text style={s.heroTitle}>Connect Lemonade</Text>
              <Text style={s.heroSub}>Create claims from vet invoices and see reimbursement status here.</Text>
              <TouchableOpacity style={s.btnCoral} onPress={() => router.push('/invoices')}><Text style={s.btnTxt}>Connect insurance</Text></TouchableOpacity>
            </Card>
          )}

          {tab === 'Medical' && (
            <>
              {/* health summary hero */}
              <View style={s.hero}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={s.kicker}>{pet.name.toUpperCase()} · HEALTH SUMMARY</Text>
                  <Text style={s.stable}>{conditions.length ? 'MONITOR' : 'STABLE'}</Text>
                </View>
                <View style={s.statRow}>
                  <Stat n={visitsThisYear} l="Vet visits this year" />
                  <Stat n={conditions.length} l="Conditions" />
                  <Stat n={latestW ?? '—'} l={target ? `Weight · target ${target}` : 'Weight (lb)'} />
                </View>
                {pct !== null && <><View style={s.bar}><View style={[s.barFill, { width: `${pct}%` }]} /></View>
                  <Text style={s.heroNote}>Weight plan: {pct}% toward target{weights.some((w) => w.source === 'device') ? ' · monitored by smart litter box scale' : ''}</Text></>}
              </View>
              <Pills items={['Records', 'Labs', 'History', 'AI Health']} active={med} onPick={(t) => setMed(t as MedTab)} accent />

              {pendingAi.length > 0 && (
                <View style={s.review}>
                  <Text style={s.reviewTitle}>AI extracted {pendingAi.length} item{pendingAi.length > 1 ? 's' : ''} from your documents — confirm they're correct</Text>
                  {pendingAi.map((r) => (
                    <View key={r.id} style={s.reviewRow}>
                      <Text style={s.reviewTxt}>{r.vaccine ? `${r.vaccine}${r.brand ? ` · ${r.brand}` : ''} · ${fmt(r.given_on)}` : `${r.analyte} ${r.value ?? ''} ${r.unit ?? ''} · ${fmt(r.taken_on)}`}</Text>
                      <TouchableOpacity onPress={() => confirmRow(r.vaccine ? 'vaccinations' : 'lab_results', r.id)}><Text style={s.confirm}>Confirm</Text></TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {med === 'Records' && (
                <>
                  <SectionHead title="Conditions & allergies" />
                  <Card>{conditions.length ? conditions.map((c) => <Text key={c.id} style={s.body}>{c.title}</Text>) : <Text style={s.muted}>None recorded.</Text>}</Card>
                  <SectionHead title="Vaccinations" action={busy === 'upload' ? 'Uploading…' : 'Upload record'} onAction={uploadDocument} />
                  {vax.filter((v) => v.confirmed).map((v) => {
                    const d = daysUntil(v.valid_until);
                    return (
                      <Card key={v.id}>
                        <View style={s.cardHead}>
                          <Text style={s.cardTitle}>{v.brand ? `${v.brand} ` : ''}{v.vaccine}</Text>
                          {d !== null && <Text style={[s.pillSm, d < 30 ? s.pillWarn : s.pillOk]}>{d < 0 ? 'Overdue' : `Valid thru ${fmt(v.valid_until)}`}</Text>}
                        </View>
                        <Text style={s.meta}>Given {fmt(v.given_on)}{v.clinic ? ` · ${v.clinic}` : ''}{v.dose ? ` · ${v.dose}` : ''}{v.lot_number ? ` · lot ${v.lot_number}` : ''}</Text>
                        {v.reactions ? <Text style={s.reaction}>Reaction noted: {v.reactions}</Text> : null}
                      </Card>
                    );
                  })}
                  <SectionHead title="Documents" />
                  {docs.map((d) => <Card key={d.id}><Text style={s.cardTitle}>{d.title}</Text><Text style={s.meta}>{d.kind.replace('_', ' ')} · {d.ai_status === 'parsed' ? 'AI read ✓' : d.ai_status} · {fmt(d.created_at)}</Text></Card>)}
                </>
              )}

              {med === 'Labs' && (
                <>
                  <SectionHead title="Lab results" action="Upload report" onAction={uploadDocument} />
                  {Object.entries(groupBy(labs.filter((l) => l.confirmed), (l) => `${l.panel}|${l.taken_on}`)).map(([k, rows]) => (
                    <Card key={k}>
                      <View style={s.cardHead}><Text style={s.cardTitle}>{rows[0].panel}</Text><Text style={s.meta}>{fmt(rows[0].taken_on)}</Text></View>
                      {rows.map((r) => (
                        <View key={r.id} style={s.labRow}>
                          <Text style={s.body}>{r.analyte}</Text>
                          <Text style={[s.labVal, r.flag && r.flag !== 'normal' ? s.labFlag : s.labOk]}>{r.value} {r.unit} · {r.flag === 'high' ? 'high' : r.flag === 'low' ? 'low' : 'normal'}</Text>
                        </View>
                      ))}
                    </Card>
                  ))}
                  <Text style={s.help}>Flags are lab reference ranges, not a diagnosis. See AI Health for pattern analysis — and your vet for interpretation.</Text>
                </>
              )}

              {med === 'History' && (
                <>
                  <View style={s.note}><Text style={s.noteTxt}>Events are processed by AI to catch anomalies and group related entries. Sensitive history is visible only to users with the right access level.</Text></View>
                  {history.map((h) => (
                    <View key={h.id} style={[s.card, { borderLeftWidth: 4, borderLeftColor: h.record_type === 'condition' ? Colors.urgent : Colors.teal }]}>
                      <View style={s.cardHead}><Text style={s.cardTitle}>{h.title}</Text><Text style={s.meta}>{fmt(h.record_date)}</Text></View>
                      {h.notes ? <Text style={s.meta}>{h.notes}</Text> : null}
                    </View>
                  ))}
                </>
              )}

              {med === 'AI Health' && (
                <>
                  <View style={s.disclaimer}>
                    <Text style={s.disclaimerTxt}><Text style={{ fontFamily: Fonts.bold }}>AI reasoning, not a diagnosis.</Text> Only your veterinarian can advise. This analysis surfaces patterns across labs, weight, and history so your vet can see relationships the human eye might miss.</Text>
                  </View>
                  {analysis ? (
                    <Card>
                      <View style={s.cardHead}><Text style={s.cardTitle}>{pet.name} Health Analysis</Text><Text style={s.meta}>{fmt(analysis.created_at)}</Text></View>
                      {analysis.findings.map((f: any, i: number) => (
                        <View key={i} style={s.finding}>
                          <View style={[s.dot, { backgroundColor: f.severity === 'attention' ? Colors.urgent : f.severity === 'watch' ? Colors.standard : Colors.teal }]} />
                          <View style={{ flex: 1 }}><Text style={s.findingTitle}>{f.title}</Text><Text style={s.findingBody}>{f.body}</Text></View>
                        </View>
                      ))}
                      {analysis.inputs?.data_quality?.length ? <Text style={s.help}>Data quality: {analysis.inputs.data_quality.join(' · ')}</Text> : null}
                    </Card>
                  ) : <Card><Text style={s.muted}>No analysis yet. Add labs, weights or documents, then run one.</Text></Card>}
                  <TouchableOpacity style={[s.btnNavy, busy === 'ai' && { opacity: 0.6 }]} onPress={runAnalysis} disabled={busy === 'ai'}><Text style={s.btnTxt}>{busy === 'ai' ? 'Analyzing…' : analysis ? 'Run new analysis' : 'Run AI health analysis'}</Text></TouchableOpacity>
                  {analysis && <TouchableOpacity style={[s.btnNavy, analysis.shared_with_vet_at && { backgroundColor: Colors.teal }]} onPress={shareWithVet}><Text style={s.btnTxt}>{analysis.shared_with_vet_at ? 'Shared with vet ✓' : 'Share analysis with my vet'}</Text></TouchableOpacity>}
                  {analysis && <Text style={[s.help, { textAlign: 'center' }]}>Generated with Claude · reviewed {analysis.inputs?.labs ?? 0} lab values, {analysis.inputs?.weights ?? 0} weight entries, {analysis.inputs?.events ?? 0} history events</Text>}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- small pieces -----------------------------------------------------------
function groupBy<T>(arr: T[], key: (t: T) => string) { return arr.reduce((m, x) => ((m[key(x)] ||= []).push(x), m), {} as Record<string, T[]>); }
function Pills({ items, active, onPick, accent }: { items: string[]; active: string; onPick: (v: string) => void; accent?: boolean }) {
  const on = accent ? Colors.teal : Colors.navy;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {items.map((it) => (
        <TouchableOpacity key={it} onPress={() => onPick(it)} style={[s.pill, { borderColor: active === it ? on : Colors.borderInput, backgroundColor: active === it ? on : Colors.white }]}>
          <Text style={[s.pillTxt, active === it && { color: Colors.white }]}>{it}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
function Chip({ children, teal }: { children: React.ReactNode; teal?: boolean }) { return <Text style={[s.chip, teal && s.chipTeal]}>{children}</Text>; }
function Card({ children, title, dark }: { children: React.ReactNode; title?: string; dark?: boolean }) {
  return <View style={[s.card, dark && s.cardDark]}>{title ? <Text style={[s.kicker, !dark && { color: Colors.textTertiary }]}>{title}</Text> : null}{children}</View>;
}
function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <View style={s.sectionHead}><Text style={s.section}>{title}</Text>{action ? <TouchableOpacity onPress={onAction}><Text style={s.link}>{action}</Text></TouchableOpacity> : null}</View>;
}
function Stat({ n, l }: { n: any; l: string }) { return <View style={s.stat}><Text style={s.statN}>{n}</Text><Text style={s.statL}>{l}</Text></View>; }
function Row({ k, v, badge, swatches, last }: { k: string; v: string; badge?: string; swatches?: string[]; last?: boolean }) {
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Text style={s.rowK}>{k}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {swatches?.map((c) => <View key={c} style={[s.swatch, { backgroundColor: c.toLowerCase() }]} />)}
        <Text style={s.rowV}>{v}</Text>
        {badge ? <Text style={s.aiBadge}>{badge}</Text> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 16 },
  avatarEmpty: { backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: Colors.white, fontFamily: Fonts.extrabold, fontSize: 22 },
  name: { fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.navy },
  sub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
  ownPill: { fontFamily: Fonts.bold, fontSize: 10.5, color: Colors.tealDark, backgroundColor: Colors.tealBg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pill: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  pillTxt: { fontFamily: Fonts.semibold, fontSize: 13, color: Colors.navy },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { fontFamily: Fonts.bold, fontSize: 11.5, color: Colors.navy, backgroundColor: Colors.surface, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  chipTeal: { color: Colors.tealDark, backgroundColor: Colors.tealBg },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  cardDark: { backgroundColor: Colors.navy, borderColor: Colors.navy, borderRadius: 16, padding: 18 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontFamily: Fonts.bold, fontSize: 13.5, color: Colors.navy },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 12, letterSpacing: 0.6, color: '#B9BCE0' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }), fontSize: 15, fontWeight: '800', color: Colors.navy },
  help: { fontFamily: Fonts.regular, fontSize: 11.5, color: Colors.textSecondary, lineHeight: 17 },
  table: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowK: { fontFamily: Fonts.regular, fontSize: 12.5, color: Colors.textTertiary },
  rowV: { fontFamily: Fonts.bold, fontSize: 12.5, color: Colors.navy },
  aiBadge: { fontFamily: Fonts.extrabold, fontSize: 9.5, color: Colors.white, backgroundColor: Colors.coral, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: Colors.borderInput },
  hero: { backgroundColor: Colors.navy, borderRadius: 16, padding: 16, gap: 12 },
  heroTitle: { fontFamily: Fonts.extrabold, fontSize: 17, color: Colors.white, marginTop: 8 },
  heroSub: { fontFamily: Fonts.regular, fontSize: 12, color: '#B9BCE0', marginTop: 4 },
  heroNote: { fontFamily: Fonts.regular, fontSize: 10.5, color: '#B9BCE0' },
  stable: { fontFamily: Fonts.bold, fontSize: 10.5, color: Colors.tealDark, backgroundColor: '#BDE8E4', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4 },
  statN: { fontFamily: Fonts.extrabold, fontSize: 17, color: Colors.white },
  statL: { fontFamily: Fonts.semibold, fontSize: 10, color: '#B9BCE0', marginTop: 2, textAlign: 'center' },
  bar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.coral, borderRadius: 3 },
  review: { backgroundColor: Colors.standardBg, borderRadius: 14, padding: 14, gap: 8 },
  reviewTitle: { fontFamily: Fonts.bold, fontSize: 12.5, color: '#8A5A00' },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  reviewTxt: { flex: 1, fontFamily: Fonts.regular, fontSize: 12, color: Colors.textBody },
  confirm: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.tealDark },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  section: { fontFamily: Fonts.extrabold, fontSize: 13, color: Colors.navy },
  link: { fontFamily: Fonts.bold, fontSize: 12.5, color: Colors.coral },
  meta: { fontFamily: Fonts.regular, fontSize: 11.5, color: Colors.textTertiary },
  body: { fontFamily: Fonts.regular, fontSize: 12.5, color: Colors.textBody },
  muted: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary },
  reaction: { fontFamily: Fonts.semibold, fontSize: 11.5, color: Colors.urgent },
  pillSm: { fontFamily: Fonts.bold, fontSize: 10.5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  pillOk: { color: Colors.tealDark, backgroundColor: Colors.tealBg },
  pillWarn: { color: '#8A5A00', backgroundColor: Colors.standardBg },
  labRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  labVal: { fontFamily: Fonts.bold, fontSize: 12.5 },
  labFlag: { color: Colors.urgent }, labOk: { color: Colors.teal },
  note: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12 },
  noteTxt: { fontFamily: Fonts.regular, fontSize: 11.5, color: Colors.textBody, lineHeight: 17 },
  disclaimer: { backgroundColor: Colors.criticalBg, borderWidth: 1, borderColor: '#F5C6C2', borderRadius: 12, padding: 12 },
  disclaimerTxt: { fontFamily: Fonts.regular, fontSize: 11.5, color: '#8C2F2A', lineHeight: 17 },
  finding: { flexDirection: 'row', gap: 10, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  findingTitle: { fontFamily: Fonts.bold, fontSize: 12.5, color: Colors.navy },
  findingBody: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textBody, lineHeight: 17, marginTop: 2 },
  btnNavy: { backgroundColor: Colors.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnCoral: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  btnTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 13.5 },
});
