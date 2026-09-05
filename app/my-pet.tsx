import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft,
  Pencil,
  TriangleAlert as AlertTriangle,
  Calendar,
  Stethoscope,
  FileText,
  Clock,
  PawPrint,
  Plus,
  X,
  Check,
  Syringe,
  Heart,
  Pill,
  Scale,
  Bug,
  Scissors,
  Bone,
  Sparkles,
  NotebookPen,
  ExternalLink,
  ChevronRight,
} from 'lucide-react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { useAuth } from '@/lib/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { InlineBanner } from '@/components/InlineBanner';
import { ConfirmDialog, type ConfirmConfig } from '@/components/ConfirmDialog';
import SignedImage from '@/components/SignedImage';

// ── Types ────────────────────────────────────────────────────────────────────

type Pet = {
  id: string;
  name: string | null;
  breed: string | null;
  species: string | null;
  age_text: string | null;
  gender: string | null;
  main_photo_url: string | null;
  description: string | null;
  spayed_neutered: boolean | null;
  vaccinated: boolean | null;
  weight_kg: number | null;
};

type Vaccination = {
  id: string;
  vaccine: string;
  administered_on: string | null;
  next_due_on: string | null;
  vet_clinic: string | null;
};

type CareEvent = {
  id: string;
  event_type: string;
  occurred_on: string;
  title: string | null;
  notes: string | null;
  vet_clinic: string | null;
  weight_kg: number | null;
  next_due_on: string | null;
};

type PetDocument = {
  id: string;
  kind: string;
  file_path: string;
  title: string | null;
  created_at: string;
};

type FollowUp = {
  id: string;
  milestone: string | null;
  due_date: string | null;
  status: string | null;
  submitted_at: string | null;
  requirement: string | null;
};

type Tab = 'overview' | 'health' | 'documents' | 'history';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'health', label: 'Health' },
  { id: 'documents', label: 'Documents' },
  { id: 'history', label: 'History' },
];

const CARE_TYPES = [
  { id: 'vet_visit', label: 'Vet Visit', icon: Stethoscope },
  { id: 'medication', label: 'Medication', icon: Pill },
  { id: 'weight', label: 'Weight', icon: Scale },
  { id: 'deworming', label: 'Deworming', icon: Bug },
  { id: 'flea_tick', label: 'Flea / Tick', icon: Bug },
  { id: 'grooming', label: 'Grooming', icon: Scissors },
  { id: 'surgery', label: 'Surgery', icon: Heart },
  { id: 'dental', label: 'Dental', icon: Bone },
  { id: 'note', label: 'Note', icon: NotebookPen },
];

const AAHA_URL = 'https://www.aaha.org/your-pet/pet-microchip-lookup/';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(value: string | null): string {
  if (!value) return 'Date unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Date unknown';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function titleCase(value: string | null): string {
  if (!value) return '';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

type Urgency = 'overdue' | 'due_soon' | 'upcoming' | 'none';

function urgencyFor(dueOn: string | null): Urgency {
  const days = daysUntil(dueOn);
  if (days === null) return 'none';
  if (days < 0) return 'overdue';
  if (days <= 30) return 'due_soon';
  return 'upcoming';
}

const URGENCY_STYLE: Record<Urgency, { color: string; bg: string; label: (d: number) => string }> = {
  overdue: { color: Colors.critical, bg: Colors.criticalBg, label: (d) => `${Math.abs(d)} day${Math.abs(d) !== 1 ? 's' : ''} overdue` },
  due_soon: { color: Colors.urgent, bg: Colors.urgentBg, label: (d) => `Due in ${d} day${d !== 1 ? 's' : ''}` },
  upcoming: { color: Colors.teal, bg: Colors.tealBg, label: (d) => `Due in ${d} day${d !== 1 ? 's' : ''}` },
  none: { color: Colors.textTertiary, bg: Colors.surface, label: () => '' },
};

function careIcon(type: string): React.ComponentType<{ color?: string; size?: number }> {
  return CARE_TYPES.find((c) => c.id === type)?.icon ?? (NotebookPen as any);
}

// ── Weight Trend Chart ────────────────────────────────────────────────────────

function WeightChart({ weights }: { weights: { date: string; kg: number }[] }) {
  if (weights.length < 1) return null;
  const W = 300;
  const H = 120;
  const padX = 36;
  const padY = 24;
  const chartW = W - padX - 12;
  const chartH = H - padY - 12;

  const kgs = weights.map((w) => w.kg);
  const minKg = Math.min(...kgs);
  const maxKg = Math.max(...kgs);
  const range = maxKg - minKg || 1;

  const pts = weights.map((w, i) => {
    const x = padX + (chartW * i) / (weights.length - 1);
    const y = padY + chartH - ((w.kg - minKg) / range) * chartH;
    return { x, y, ...w };
  });

  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const yMin = padY + chartH;
  const yMax = padY;

  return (
    <View style={styles.weightChartBox}>
      <Text style={styles.weightChartTitle}>Weight Trend</Text>
      <Svg width={W} height={H}>
        <Line x1={padX} y1={yMin} x2={padX} y2={yMax} stroke={Colors.borderInput} strokeWidth={1} />
        <Line x1={padX} y1={yMin} x2={W - 12} y2={yMin} stroke={Colors.borderInput} strokeWidth={1} />
        <SvgText x={padX - 6} y={yMin + 4} fontSize={9} fill={Colors.textTertiary} textAnchor="end">
          {minKg.toFixed(1)}
        </SvgText>
        <SvgText x={padX - 6} y={yMax + 3} fontSize={9} fill={Colors.textTertiary} textAnchor="end">
          {maxKg.toFixed(1)}
        </SvgText>
        <Polyline points={polyline} fill="none" stroke={Colors.coral} strokeWidth={2} />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={Colors.coral} />
        ))}
        {pts.map((p, i) => (
          <SvgText key={`l${i}`} x={p.x} y={yMin + 11} fontSize={8} fill={Colors.textTertiary} textAnchor="middle">
            {(() => { const d = new Date(p.date); const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[d.getMonth()]} ${d.getDate()}`; })()}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function MyPetScreen() {
  const { user, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{ adoptionId?: string; petId?: string }>();
  const adoptionId = typeof params.adoptionId === 'string' ? params.adoptionId : undefined;
  const petIdParam = typeof params.petId === 'string' ? params.petId : undefined;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [pet, setPet] = useState<Pet | null>(null);
  const [adoptedAt, setAdoptedAt] = useState<string | null>(null);
  const [microchip, setMicrochip] = useState<string | null>(null);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [careEvents, setCareEvents] = useState<CareEvent[]>([]);
  const [documents, setDocuments] = useState<PetDocument[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add care event modal
  const [careModalVisible, setCareModalVisible] = useState(false);
  const [careForm, setCareForm] = useState({
    event_type: 'vet_visit',
    occurred_on: new Date().toISOString().slice(0, 10),
    title: '',
    notes: '',
    vet_clinic: '',
    weight_kg: '',
    next_due_on: '',
  });
  const [savingCare, setSavingCare] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);

  // Add vaccination modal
  const [vaxModalVisible, setVaxModalVisible] = useState(false);
  const [vaxForm, setVaxForm] = useState({
    vaccine: '',
    administered_on: new Date().toISOString().slice(0, 10),
    next_due_on: '',
    vet_clinic: '',
  });
  const [savingVax, setSavingVax] = useState(false);

  const [uploadingDoc, setUploadingDoc] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadPet = useCallback(async () => {
    if (!user || (!adoptionId && !petIdParam)) {
      if (!adoptionId && !petIdParam) {
        setError('We could not find that pet.');
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError(null);

    try {
      let petId: string | null = null;

      if (petIdParam) {
        const { data: petRow, error: petErr } = await supabase
          .from('pets')
          .select('id, name, breed, species, age_text, gender, main_photo_url, description, spayed_neutered, vaccinated, weight_kg')
          .eq('id', petIdParam)
          .maybeSingle();
        if (petErr || !petRow) {
          setError('We could not load this pet. Please try again.');
          setLoading(false);
          return;
        }
        setPet(petRow as Pet);
        petId = petRow.id;
      } else if (adoptionId) {
        const { data: adoptionRow, error: adoptionError } = await supabase
          .from('adoptions')
          .select('id, adopted_at, pet:pets(id, name, breed, species, age_text, gender, main_photo_url, description, spayed_neutered)')
          .eq('id', adoptionId)
          .maybeSingle();
        if (adoptionError || !adoptionRow) {
          setError('We could not load this pet. Please try again.');
          setLoading(false);
          return;
        }
        const petData = Array.isArray(adoptionRow.pet) ? adoptionRow.pet[0] ?? null : adoptionRow.pet;
        setPet(petData as Pet);
        setAdoptedAt(adoptionRow.adopted_at);
        petId = petData?.id ?? null;
      }

      if (!petId) {
        setError('We could not find that pet.');
        setLoading(false);
        return;
      }

      const [vaxRes, careRes, docRes, idRes, followRes] = await Promise.all([
        supabase.from('pet_vaccinations').select('id, vaccine, administered_on, next_due_on, vet_clinic').eq('pet_id', petId).order('administered_on', { ascending: false }),
        supabase.from('pet_care_events').select('id, event_type, occurred_on, title, notes, vet_clinic, weight_kg, next_due_on').eq('pet_id', petId).order('occurred_on', { ascending: false }),
        supabase.from('pet_documents').select('id, kind, file_path, title, created_at').eq('pet_id', petId).order('created_at', { ascending: false }),
        supabase.from('pet_identifiers').select('microchip_number').eq('pet_id', petId).maybeSingle(),
        adoptionId
          ? supabase.from('follow_ups').select('id, milestone, due_date, status, submitted_at, requirement').eq('adoption_id', adoptionId).order('due_date', { ascending: true })
          : Promise.resolve({ data: [], error: null } as const),
      ]);

      setVaccinations((vaxRes.data as Vaccination[]) ?? []);
      setCareEvents((careRes.data as CareEvent[]) ?? []);
      setDocuments((docRes.data as PetDocument[]) ?? []);
      setMicrochip((idRes.data as { microchip_number: string | null } | null)?.microchip_number ?? null);
      setFollowUps((followRes.data as FollowUp[]) ?? []);
    } catch {
      setError('We could not load this pet. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, adoptionId, petIdParam]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/(tabs)/profile');
  }, [authLoading, user]);

  useEffect(() => { loadPet(); }, [loadPet]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const saveCareEvent = async () => {
    if (!pet) return;
    setSavingCare(true);
    try {
      const insert: Record<string, unknown> = {
        pet_id: pet.id,
        event_type: careForm.event_type,
        occurred_on: careForm.occurred_on,
        title: careForm.title.trim() || null,
        notes: careForm.notes.trim() || null,
        vet_clinic: careForm.vet_clinic.trim() || null,
        next_due_on: careForm.next_due_on || null,
        recorded_by: user?.id ?? null,
      };
      if (careForm.event_type === 'weight' && careForm.weight_kg) {
        insert.weight_kg = parseFloat(careForm.weight_kg);
      }
      const { error: insErr } = await supabase.from('pet_care_events').insert(insert);
      if (insErr) throw insErr;
      setCareModalVisible(false);
      setCareForm({ event_type: 'vet_visit', occurred_on: new Date().toISOString().slice(0, 10), title: '', notes: '', vet_clinic: '', weight_kg: '', next_due_on: '' });
      await loadPet();
    } catch (err) {
      console.error('[my-pet] save care event failed:', err);
      setBanner({ message: 'Could not save the entry. Please try again.', kind: 'error' });
    } finally {
      setSavingCare(false);
    }
  };

  const saveVaccination = async () => {
    if (!pet || !vaxForm.vaccine.trim()) {
      setBanner({ message: 'Please enter a vaccine name.', kind: 'error' });
      return;
    }
    setSavingVax(true);
    try {
      const { error: insErr } = await supabase.from('pet_vaccinations').insert({
        pet_id: pet.id,
        vaccine: vaxForm.vaccine.trim(),
        administered_on: vaxForm.administered_on || null,
        next_due_on: vaxForm.next_due_on || null,
        vet_clinic: vaxForm.vet_clinic.trim() || null,
        recorded_by: user?.id ?? null,
      });
      if (insErr) throw insErr;
      setVaxModalVisible(false);
      setVaxForm({ vaccine: '', administered_on: new Date().toISOString().slice(0, 10), next_due_on: '', vet_clinic: '' });
      await loadPet();
    } catch (err) {
      console.error('[my-pet] save vaccination failed:', err);
      setBanner({ message: 'Could not save the vaccination. Please try again.', kind: 'error' });
    } finally {
      setSavingVax(false);
    }
  };

  const uploadDocument = async () => {
    if (!pet || !user) return;
    setUploadingDoc(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      if (result.canceled) { setUploadingDoc(false); return; }
      const uri = result.assets[0].uri;
      const resp = await fetch(uri);
      const arrayBuffer = await resp.arrayBuffer();
      const contentType = resp.headers.get('content-type') || 'application/octet-stream';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('pdf') ? 'pdf' : 'jpg';
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('pet-documents').upload(filePath, arrayBuffer, { contentType, upsert: false });
      if (upErr) throw upErr;
      const { data: docRow, error: docErr } = await supabase.from('pet_documents').insert({
        pet_id: pet.id,
        kind: 'medical_record',
        file_path: filePath,
        title: `Upload ${(() => { const d = new Date(); const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[d.getMonth()]} ${d.getDate()}`; })()}`,
        uploaded_by: user.id,
      }).select('id').single();
      if (docErr) throw docErr;

      if (docRow?.id) {
        const { data: session } = await supabase.auth.getSession();
        await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/extract-vet-record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.session?.access_token}`,
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ document_id: docRow.id }),
        });
      }
      await loadPet();
      setBanner({ message: 'Document saved. Open Edit to review anything the AI found.', kind: 'success' });
    } catch (err) {
      console.error('[my-pet] upload document failed:', err);
      setBanner({ message: 'Could not upload the document. Please try again.', kind: 'error' });
    } finally {
      setUploadingDoc(false);
    }
  };

  const openDocument = async (doc: PetDocument) => {
    try {
      const { data, error: signedErr } = await supabase.storage.from('pet-documents').createSignedUrl(doc.file_path, 3600);
      if (signedErr || !data?.signedUrl) throw signedErr ?? new Error('Could not open file');
      if (Platform.OS === 'web') {
        window.open(data.signedUrl, '_blank');
      } else {
        await Linking.openURL(data.signedUrl);
      }
    } catch (err) {
      console.error('[my-pet] open document failed:', err);
      setBanner({ message: 'Could not open this document.', kind: 'error' });
    }
  };

  const deleteDocument = (doc: PetDocument) => {
    setConfirmConfig({
      title: 'Remove document?',
      message: 'This will permanently delete the file.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await supabase.storage.from('pet-documents').remove([doc.file_path]);
          await supabase.from('pet_documents').delete().eq('id', doc.id);
          setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        } catch (err) {
          console.error('[my-pet] delete document failed:', err);
          setBanner({ message: 'Could not delete the document.', kind: 'error' });
        }
      },
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.coral} />
      </SafeAreaView>
    );
  }

  const breedSpecies = [pet?.breed, pet?.species].map((v) => v?.trim()).filter(Boolean).join(' • ');
  const weightEntries = careEvents
    .filter((e) => e.event_type === 'weight' && e.weight_kg != null)
    .map((e) => ({ date: e.occurred_on, kg: e.weight_kg! }))
    .reverse();
    const latestKg = weightEntries.length ? weightEntries[weightEntries.length - 1].kg : pet?.weight_kg;
  const latestLb = latestKg != null ? Math.round(latestKg * 2.20462 * 10) / 10 : null;
  const blob = [
    ...vaccinations.map((v) => v.vaccine),
    ...careEvents.map((c) => `${c.title || ''} ${c.notes || ''}`),
  ].join(' ').toLowerCase();
  const felvNeg = /felv|fiv|leukemia/.test(blob) && /negat/.test(blob);
  const dueVax = vaccinations.filter((v) => v.next_due_on);

  // Merge vaccinations + care events into one timeline
  const timeline: { date: string; type: 'vaccination' | 'care'; data: Vaccination | CareEvent }[] = [
    ...vaccinations.map((v) => ({ date: v.administered_on ?? '', type: 'vaccination' as const, data: v as Vaccination | CareEvent })),
    ...careEvents.map((c) => ({ date: c.occurred_on, type: 'care' as const, data: c as Vaccination | CareEvent })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{pet?.name || 'My Pet'}</Text>
        {petIdParam ? (
          <TouchableOpacity style={styles.topBtn} onPress={() => router.push(`/pet-record?petId=${petIdParam}`)} activeOpacity={0.75}>
            <Pencil color={Colors.text} size={18} />
          </TouchableOpacity>
        ) : (
          <View style={styles.topBtnPlaceholder} />
        )}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              <View>
                <View style={styles.petCard}>
                  {pet?.main_photo_url ? (
                    <SignedImage path={pet.main_photo_url} style={styles.petPhoto} />
                  ) : (
                    <View style={[styles.petPhoto, styles.petPhotoFallback]}>
                      <PawPrint color={Colors.coral} size={36} />
                    </View>
                  )}
                  <Text style={styles.petName}>{pet?.name || 'Unnamed pet'}</Text>
                  {breedSpecies ? <Text style={styles.petMeta}>{breedSpecies}</Text> : null}
                  {pet?.age_text ? <Text style={styles.petMeta}>{pet.age_text}</Text> : null}
                  {pet?.gender && <Text style={styles.petMeta}>{titleCase(pet.gender)}</Text>}
                  {pet?.spayed_neutered && <Text style={styles.petMeta}>Spayed / Neutered</Text>}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, justifyContent: 'center' }}>
                  {pet?.spayed_neutered ? (
                <View style={{ backgroundColor: Colors.tealBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: Colors.tealDark, fontFamily: Fonts.bold, fontSize: FontSizes.xs }}>Spayed/Neutered</Text>
                    </View>
                  ) : null}
                  {microchip ? (
                    <View style={{ backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: Colors.navy, fontFamily: Fonts.bold, fontSize: FontSizes.xs }}>Microchipped</Text>
                    </View>
                  ) : null}
                  {(pet?.vaccinated || vaccinations.length > 0) ? (
                    <View style={{ backgroundColor: Colors.tealBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: Colors.tealDark, fontFamily: Fonts.bold, fontSize: FontSizes.xs }}>
                        Vaccines {vaccinations.length ? `(${vaccinations.length})` : ''}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: Colors.urgentBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: Colors.critical, fontFamily: Fonts.bold, fontSize: FontSizes.xs }}>Vaccines unknown</Text>
                    </View>
                  )}
                  {latestLb != null ? (
                    <View style={{ backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: Colors.navy, fontFamily: Fonts.bold, fontSize: FontSizes.xs }}>{latestLb} lb</Text>
                    </View>
                  ) : null}
                  {felvNeg ? (
                    <View style={{ backgroundColor: Colors.tealBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: Colors.tealDark, fontFamily: Fonts.bold, fontSize: FontSizes.xs }}>FeLV/FIV negative</Text>
                    </View>
                  ) : null}
                </View>
                {dueVax.length > 0 ? (
                  <View style={{ marginTop: 10, width: '100%' }}>
                    {dueVax.slice(0, 4).map((v) => (
                      <Text key={v.id} style={{ fontSize: FontSizes.xs, fontFamily: Fonts.medium, color: Colors.textSecondary, textAlign: 'center' }}>
                        {v.vaccine} due {v.next_due_on}
                      </Text>
                    ))}
                  </View>
                ) : null}
                  </View>
                  {adoptedAt && (
                    <View style={styles.adoptedRow}>
                      <Calendar color={Colors.textSecondary} size={16} />
                      <Text style={styles.adoptedText}>Adopted {formatDate(adoptedAt)}</Text>
                    </View>
                  )}
                  {pet?.description ? <Text style={styles.petDescription}>{pet.description}</Text> : null}
                </View>

                {/* Microchip */}
                <View style={styles.sectionHeader}>
                  <PawPrint color={Colors.navy} size={18} />
                  <Text style={styles.sectionTitle}>Microchip</Text>
                </View>
                <View style={styles.infoCard}>
                  {microchip ? (
                    <Text style={styles.microchipNumber}>{microchip}</Text>
                  ) : (
                    <Text style={styles.emptyText}>No microchip number recorded.</Text>
                  )}
                  <Text style={styles.microchipDisclaimer}>
                    Storing the number here doesn't register the chip — check it's registered to you at the AAHA universal lookup, and update the registry after a move.
                  </Text>
                  <TouchableOpacity style={styles.aahaBtn} onPress={() => Linking.openURL(AAHA_URL)} activeOpacity={0.85}>
                    <ExternalLink color={Colors.tealDark} size={14} />
                    <Text style={styles.aahaBtnText}>Check AAHA Universal Lookup</Text>
                  </TouchableOpacity>
                </View>

                {/* Owner actions */}
                {petIdParam && (
                  <View style={styles.ownerActions}>
                    <TouchableOpacity
                      style={styles.editBtn}
                      onPress={() => router.push(`/pet-record?petId=${petIdParam}`)}
                      activeOpacity={0.85}
                    >
                      <Pencil color={Colors.navy} size={16} />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.lostBtn}
                      onPress={() => router.push(`/lost-stray-report?prefillPetId=${petIdParam}`)}
                      activeOpacity={0.85}
                    >
                      <AlertTriangle color={Colors.critical} size={16} />
                      <Text style={styles.lostBtnText}>This pet is lost</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* ── HEALTH ── */}
            {activeTab === 'health' && (
              <View>
                {/* Weight chart */}
                {weightEntries.length >= 1 && <WeightChart weights={weightEntries} />}

                {/* Vaccinations */}
                <View style={styles.sectionHeader}>
                  <Syringe color={Colors.navy} size={18} />
                  <Text style={styles.sectionTitle}>Vaccinations</Text>
                  <TouchableOpacity style={styles.addSmallBtn} onPress={() => setVaxModalVisible(true)} activeOpacity={0.85}>
                    <Plus color={Colors.coral} size={14} />
                    <Text style={styles.addSmallText}>Add</Text>
                  </TouchableOpacity>
                </View>
                {vaccinations.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No vaccinations recorded yet.</Text>
                  </View>
                ) : (
                  vaccinations.map((v) => {
                    const urg = urgencyFor(v.next_due_on);
                    const urgStyle = URGENCY_STYLE[urg];
                    const d = daysUntil(v.next_due_on);
                    return (
                      <View key={v.id} style={styles.recordCard}>
                        <View style={styles.recordTopRow}>
                          <Text style={styles.recordTitle}>{v.vaccine}</Text>
                          {v.next_due_on && (
                            <View style={[styles.urgencyBadge, { backgroundColor: urgStyle.bg }]}>
                              <Text style={[styles.urgencyText, { color: urgStyle.color }]}>{urgStyle.label(d!)}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.recordDetail}>Given: {formatDate(v.administered_on)}</Text>
                        {v.next_due_on && <Text style={styles.recordDetail}>Next due: {formatDate(v.next_due_on)}</Text>}
                        {v.vet_clinic && <Text style={styles.recordDetail}>Clinic: {v.vet_clinic}</Text>}
                      </View>
                    );
                  })
                )}

                {/* Care log timeline */}
                <View style={styles.sectionHeader}>
                  <Stethoscope color={Colors.navy} size={18} />
                  <Text style={styles.sectionTitle}>Care Log</Text>
                  <TouchableOpacity style={styles.addSmallBtn} onPress={() => setCareModalVisible(true)} activeOpacity={0.85}>
                    <Plus color={Colors.coral} size={14} />
                    <Text style={styles.addSmallText}>Add entry</Text>
                  </TouchableOpacity>
                </View>
                {timeline.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No care entries yet. Tap "Add entry" to start.</Text>
                  </View>
                ) : (
                  timeline.map((item) => {
                    if (item.type === 'vaccination') return null; // vaccinations shown above
                    const c = item.data as CareEvent;
                    const Icon = careIcon(c.event_type);
                    const urg = urgencyFor(c.next_due_on);
                    const urgStyle = URGENCY_STYLE[urg];
                    const d = daysUntil(c.next_due_on);
                    return (
                      <View key={c.id} style={styles.recordCard}>
                        <View style={styles.recordTopRow}>
                          <View style={styles.careTypeRow}>
                            <View style={[styles.careIconBox, { backgroundColor: `${Colors.navy}0F` }]}>
                              <Icon color={Colors.navy} size={14} />
                            </View>
                            <Text style={styles.recordTitle}>{c.title || titleCase(c.event_type)}</Text>
                          </View>
                          {c.next_due_on && (
                            <View style={[styles.urgencyBadge, { backgroundColor: urgStyle.bg }]}>
                              <Text style={[styles.urgencyText, { color: urgStyle.color }]}>{urgStyle.label(d!)}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.recordDetail}>{formatDate(c.occurred_on)}</Text>
                        {c.weight_kg != null && <Text style={styles.recordDetail}>Weight: {c.weight_kg} kg</Text>}
                        {c.vet_clinic && <Text style={styles.recordDetail}>Clinic: {c.vet_clinic}</Text>}
                        {c.notes && <Text style={styles.recordNotes}>{c.notes}</Text>}
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* ── DOCUMENTS ── */}
            {activeTab === 'documents' && (
              <View>
                <View style={styles.sectionHeader}>
                  <FileText color={Colors.navy} size={18} />
                  <Text style={styles.sectionTitle}>Documents</Text>
                  <TouchableOpacity style={styles.addSmallBtn} onPress={uploadDocument} disabled={uploadingDoc} activeOpacity={0.85}>
                    {uploadingDoc ? <ActivityIndicator color={Colors.coral} size={14} /> : <Plus color={Colors.coral} size={14} />}
                    <Text style={styles.addSmallText}>Upload</Text>
                  </TouchableOpacity>
                </View>
                {documents.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No documents yet. Tap "Upload" to add one.</Text>
                  </View>
                ) : (
                  documents.map((doc) => (
                    <TouchableOpacity key={doc.id} style={styles.docCard} onPress={() => openDocument(doc)} activeOpacity={0.85}>
                      <View style={styles.docIconBox}>
                        <FileText color={Colors.navy} size={18} />
                      </View>
                      <View style={styles.docInfo}>
                        <Text style={styles.docTitle}>{doc.title || 'Untitled document'}</Text>
                        <Text style={styles.docDate}>{formatDate(doc.created_at)}</Text>
                      </View>
                      <TouchableOpacity style={styles.docDelete} onPress={() => deleteDocument(doc)}>
                        <X color={Colors.critical} size={16} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* ── HISTORY ── */}
            {activeTab === 'history' && (
              <View>
                {adoptedAt && (
                  <>
                    <View style={styles.sectionHeader}>
                      <Calendar color={Colors.navy} size={18} />
                      <Text style={styles.sectionTitle}>Adoption</Text>
                    </View>
                    <View style={styles.infoCard}>
                      <Text style={styles.recordDetail}>Adopted on {formatDate(adoptedAt)}</Text>
                    </View>
                  </>
                )}

                <View style={styles.sectionHeader}>
                  <Clock color={Colors.navy} size={18} />
                  <Text style={styles.sectionTitle}>Follow-Ups</Text>
                </View>
                {followUps.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No follow-ups scheduled.</Text>
                  </View>
                ) : (
                  followUps.map((fu) => {
                    const state: 'completed' | 'due' | 'upcoming' =
                      fu.status === 'completed' || fu.submitted_at ? 'completed' :
                      fu.due_date && (daysUntil(fu.due_date) ?? 1) < 0 ? 'due' : 'upcoming';
                    const stateConfig = {
                      completed: { label: 'Completed', color: Colors.teal, Icon: Check },
                      due: { label: 'Overdue', color: Colors.critical, Icon: AlertTriangle },
                      upcoming: { label: 'Upcoming', color: Colors.navy, Icon: Clock },
                    }[state];
                    const { Icon } = stateConfig;
                    return (
                      <View key={fu.id} style={styles.recordCard}>
                        <View style={styles.recordTopRow}>
                          <Text style={styles.recordTitle}>{titleCase(fu.milestone) || 'Milestone'}</Text>
                          <View style={[styles.urgencyBadge, { backgroundColor: `${stateConfig.color}1A` }]}>
                            <Icon color={stateConfig.color} size={12} />
                            <Text style={[styles.urgencyText, { color: stateConfig.color }]}>{stateConfig.label}</Text>
                          </View>
                        </View>
                        <Text style={styles.recordDetail}>Due {formatDate(fu.due_date)}</Text>
                        {fu.requirement ? <Text style={styles.recordNotes}>{fu.requirement}</Text> : null}
                      </View>
                    );
                  })
                )}

                {/* Full timeline */}
                <View style={styles.sectionHeader}>
                  <Stethoscope color={Colors.navy} size={18} />
                  <Text style={styles.sectionTitle}>All Activity</Text>
                </View>
                {timeline.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No activity recorded yet.</Text>
                  </View>
                ) : (
                  timeline.map((item) => {
                    if (item.type === 'vaccination') {
                      const v = item.data as Vaccination;
                      return (
                        <View key={v.id} style={styles.recordCard}>
                          <View style={styles.recordTopRow}>
                            <View style={styles.careTypeRow}>
                              <View style={[styles.careIconBox, { backgroundColor: `${Colors.teal}0F` }]}>
                                <Syringe color={Colors.teal} size={14} />
                              </View>
                              <Text style={styles.recordTitle}>{v.vaccine}</Text>
                            </View>
                            <Text style={styles.recordDate}>{formatDate(v.administered_on)}</Text>
                          </View>
                          {v.vet_clinic && <Text style={styles.recordDetail}>Clinic: {v.vet_clinic}</Text>}
                        </View>
                      );
                    }
                    const c = item.data as CareEvent;
                    const Icon = careIcon(c.event_type);
                    return (
                      <View key={c.id} style={styles.recordCard}>
                        <View style={styles.recordTopRow}>
                          <View style={styles.careTypeRow}>
                            <View style={[styles.careIconBox, { backgroundColor: `${Colors.navy}0F` }]}>
                              <Icon color={Colors.navy} size={14} />
                            </View>
                            <Text style={styles.recordTitle}>{c.title || titleCase(c.event_type)}</Text>
                          </View>
                          <Text style={styles.recordDate}>{formatDate(c.occurred_on)}</Text>
                        </View>
                        {c.weight_kg != null && <Text style={styles.recordDetail}>Weight: {c.weight_kg} kg</Text>}
                        {c.notes && <Text style={styles.recordNotes}>{c.notes}</Text>}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Add Care Event Modal ── */}
      <Modal visible={careModalVisible} animationType="slide" transparent onRequestClose={() => setCareModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Care Entry</Text>
              <TouchableOpacity onPress={() => setCareModalVisible(false)}>
                <X color={Colors.text} size={22} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.typeGrid}>
                {CARE_TYPES.map((t) => {
                  const Icon = t.icon;
                  const selected = careForm.event_type === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.typeChip, selected && styles.typeChipActive]}
                      onPress={() => setCareForm((f) => ({ ...f, event_type: t.id }))}
                      activeOpacity={0.85}
                    >
                      <Icon color={selected ? Colors.white : Colors.navy} size={16} />
                      <Text style={[styles.typeChipText, selected && styles.typeChipTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Date</Text>
              <TextInput
                style={styles.modalInput}
                value={careForm.occurred_on}
                onChangeText={(v) => setCareForm((f) => ({ ...f, occurred_on: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />

              {careForm.event_type === 'weight' && (
                <>
                  <Text style={styles.fieldLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={careForm.weight_kg}
                    onChangeText={(v) => setCareForm((f) => ({ ...f, weight_kg: v }))}
                    placeholder="e.g. 12.5"
                    placeholderTextColor={Colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                </>
              )}

              <Text style={styles.fieldLabel}>Title (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={careForm.title}
                onChangeText={(v) => setCareForm((f) => ({ ...f, title: v }))}
                placeholder="Brief title"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Clinic (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={careForm.vet_clinic}
                onChangeText={(v) => setCareForm((f) => ({ ...f, vet_clinic: v }))}
                placeholder="Vet clinic name"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Next due (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={careForm.next_due_on}
                onChangeText={(v) => setCareForm((f) => ({ ...f, next_due_on: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Notes</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={careForm.notes}
                onChangeText={(v) => setCareForm((f) => ({ ...f, notes: v }))}
                placeholder="Additional notes..."
                placeholderTextColor={Colors.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </ScrollView>
            <TouchableOpacity style={[styles.modalSaveBtn, savingCare && { opacity: 0.6 }]} onPress={saveCareEvent} disabled={savingCare} activeOpacity={0.85}>
              {savingCare ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.modalSaveBtnText}>Save Entry</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add Vaccination Modal ── */}
      <Modal visible={vaxModalVisible} animationType="slide" transparent onRequestClose={() => setVaxModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Vaccination</Text>
              <TouchableOpacity onPress={() => setVaxModalVisible(false)}>
                <X color={Colors.text} size={22} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Vaccine name</Text>
              <TextInput
                style={styles.modalInput}
                value={vaxForm.vaccine}
                onChangeText={(v) => setVaxForm((f) => ({ ...f, vaccine: v }))}
                placeholder="e.g. Rabies, DAPP, Bordetella"
                placeholderTextColor={Colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>Date given</Text>
              <TextInput
                style={styles.modalInput}
                value={vaxForm.administered_on}
                onChangeText={(v) => setVaxForm((f) => ({ ...f, administered_on: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>Next due (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={vaxForm.next_due_on}
                onChangeText={(v) => setVaxForm((f) => ({ ...f, next_due_on: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textTertiary}
              />
              <Text style={styles.fieldLabel}>Clinic (optional)</Text>
              <TextInput
                style={styles.modalInput}
                value={vaxForm.vet_clinic}
                onChangeText={(v) => setVaxForm((f) => ({ ...f, vet_clinic: v }))}
                placeholder="Vet clinic name"
                placeholderTextColor={Colors.textTertiary}
              />
            </ScrollView>
            <TouchableOpacity style={[styles.modalSaveBtn, savingVax && { opacity: 0.6 }]} onPress={saveVaccination} disabled={savingVax} activeOpacity={0.85}>
              {savingVax ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.modalSaveBtnText}>Save Vaccination</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ConfirmDialog config={confirmConfig} onClose={() => setConfirmConfig(null)} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  centered: { justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topBtnPlaceholder: { width: 40 },
  topTitle: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text },

  tabBar: {
    flexDirection: 'row', backgroundColor: Colors.white,
    paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.coral },
  tabText: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.textTertiary },
  tabTextActive: { color: Colors.coral, fontFamily: Fonts.bold },

  scroll: { padding: 16, paddingBottom: 60 },

  errorBox: { backgroundColor: Colors.criticalBg, borderRadius: 12, padding: 16 },
  errorText: { fontSize: FontSizes.md, fontFamily: Fonts.medium, color: Colors.critical, textAlign: 'center' },

  petCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  petPhoto: { width: 120, height: 120, borderRadius: 60, marginBottom: 12 },
  petPhotoFallback: { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  petName: { fontSize: FontSizes['2xl'], fontFamily: Fonts.bold, color: Colors.text },
  petMeta: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  petDescription: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  adoptedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  adoptedText: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.textSecondary },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 16 },
  sectionTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, flex: 1 },

  addSmallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surface },
  addSmallText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.coral },

  infoCard: { backgroundColor: Colors.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  microchipNumber: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 8 },
  microchipDisclaimer: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  aahaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  aahaBtnText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.tealDark, textDecorationLine: 'underline' },

  ownerActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  editBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.white, borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: Colors.border,
  },
  editBtnText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.navy },
  lostBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.criticalBg, borderRadius: 12, paddingVertical: 12,
  },
  lostBtnText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.critical },

  weightChartBox: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 16, alignItems: 'center' },
  weightChartTitle: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text, marginBottom: 8, alignSelf: 'flex-start' },

  emptyCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16 },
  emptyText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },

  recordCard: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  recordTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  careTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  careIconBox: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  recordTitle: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text, flexShrink: 1 },
  recordDate: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.textSecondary },
  recordDetail: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  recordNotes: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },

  urgencyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  urgencyText: { fontSize: FontSizes.xs, fontFamily: Fonts.semibold },

  docCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  docIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: `${Colors.navy}0F`, justifyContent: 'center', alignItems: 'center' },
  docInfo: { flex: 1, marginLeft: 12 },
  docTitle: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  docDate: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  docDelete: { padding: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderRadius: 20, maxHeight: '85%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text },
  fieldLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary, marginBottom: 6, marginTop: 14, paddingHorizontal: 16 },
  modalInput: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, marginHorizontal: 16,
  },
  modalTextArea: { minHeight: 60, textAlignVertical: 'top' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.borderInput,
  },
  typeChipActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  typeChipText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
  typeChipTextActive: { color: Colors.white },
  modalSaveBtn: {
    backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    marginHorizontal: 16, marginTop: 16,
  },
  modalSaveBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
});
