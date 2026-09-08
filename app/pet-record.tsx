import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  FlatList,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Stethoscope,
  ClipboardCheck,
  Users,
  Syringe,
  Plus,
  Trash2,
  Calendar,
  Home,
  PawPrint,
  Shield,
  CircleAlert,
  Clock,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  X,
  Utensils,
  Heart,
  Scale,
  Pencil,
  Palette,
  FlaskConical,
  Building2,
  Download,
  Bluetooth,
  Activity,
  Share2,
} from 'lucide-react-native';
import { InlineBanner } from '@/components/InlineBanner';
import { prepareImageFile } from '@/lib/prepare-image';
import { isUsablePhoto } from '@/lib/photos';
import { ConfirmDialog, type ConfirmConfig } from '@/components/ConfirmDialog';
import { VetVaccinationModal, type Vaccination as FullVaccination, type VetClinic as ClinicInfo } from '@/components/VetVaccinationModal';
import { VetClinics } from '@/components/VetClinics';
import { VetSummaryExport, type SummaryData } from '@/components/VetSummaryExport';
import SignedImage from '@/components/SignedImage';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Page, CONTENT_MAX } from '@/components/Page';
import { WeightLineChart, LabSparkline } from '@/components/PetCharts';
import MedicalDashboard from '@/components/MedicalDashboard';
import VetExamCard from '@/components/VetExamCard';
import { Card, InnerTile } from '@/components/Card';
import { extractPdfText } from '@/lib/pdf-text';
import { SearchablePicker } from '@/components/SearchablePicker';
import { DateField } from '@/components/DateField';
import { matchCatalog, vaccineType, durationYearsFromProduct, addYearsLocal, type CatalogRow } from '@/lib/catalog';
import { SourceBadge } from '@/components/SourceBadge';
import SharePetSheet from '@/components/SharePetSheet';

function blobTypeFromName(path: string) {
  if (/\.pdf$/i.test(path)) return 'application/pdf';
  if (/\.png$/i.test(path)) return 'image/png';
  return 'image/jpeg';
}

function siteApi(path: string) {
  if (Platform.OS === 'web') return path;
  return `https://rescue-army.com${path}`;
}

function originalFileName(file: any): string {
  const raw = String(file?.name || file?.fileName || '').trim();
  if (raw) return raw.replace(/[/\\]/g, '_');
  const fromUri = String(file?.uri || '').split('?')[0].split('/').pop() || '';
  if (fromUri && /\.[a-z0-9]{2,5}$/i.test(fromUri) && !/^(ImagePicker|RNFetchBlob)/i.test(fromUri)) return fromUri;
  return 'vet-record.jpg';
}


async function fileToDataUrl(uri: string): Promise<string> {
  const resp = await fetch(uri);
  const blob = await resp.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

type Tab = 'overview' | 'medical' | 'insurance' | 'documents' | 'clinics';

const EXAM_SYSTEMS = [
  'Subjective', 'Oral-Nasal-Throat', 'Ears', 'Eyes', 'Cardiovascular', 'Respiratory',
  'Abdominal', 'Genitourinary', 'Musculoskeletal', 'Integument', 'Lymphatics', 'Neurological', 'Rectal',
];
const COAT_OPTIONS = ['shorthair', 'longhair', 'hairless'] as const;

function inferCoat(breed?: string | null, notes?: string | null): string | null {
  const q = `${breed || ''} ${notes || ''}`.toLowerCase();
  if (/sphynx|peterbald|hairless|donskoy/.test(q)) return 'hairless';
  if (/persian|himalayan|ragdoll|maine coon|norwegian forest|longhair|long-hair|fluffy/.test(q)) return 'longhair';
  if (/siamese|shorthair|dsh|american sh|british sh|abyssinian|bengal|bombay/.test(q)) return 'shorthair';
  return null;
}

function bcsTone(n?: number | null): 'ok' | 'due' | 'over' | 'unknown' {
  if (n == null || Number.isNaN(n)) return 'unknown';
  if (n <= 5 && n >= 4) return 'ok';
  if (n >= 6 && n <= 7) return 'due';
  if (n >= 8) return 'over';
  if (n <= 3) return 'over';
  return 'unknown';
}

interface Pet {
  id: string;
  name: string | null;
  breed: string | null;
  species: string | null;
  age_text: string | null;
  gender: string | null;
  status: string | null;
  description: string | null;
  main_photo_url: string | null;
  location: string | null;
  shelter_id: string | null;
  owner_id: string | null;
  vaccinated: boolean | null;
  spayed_neutered: boolean | null;
  microchipped: boolean | null;
  weight_kg: number | null;
  weight_measured_on: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  color_notes: string | null;
  breed_primary: string | null;
  breed_secondary: string | null;
  is_mixed: boolean | null;
  breed_notes: string | null;
  date_of_birth: string | null;
  body_condition_score: number | null;
  target_weight_kg: number | null;
  previous_names: string[] | null;
  coat?: string | null;
  ai_traits?: any;
}

interface Relationship {
  id: string;
  user_id: string;
  relationship: string;
  started_on: string | null;
  ended_on: string | null;
  notes: string | null;
  profile_name: string | null;
}

interface Vaccination {
  id: string;
  vaccine: string;
  brand?: string | null;
  dose?: string | null;
  reactions?: string | null;
  confirmed?: boolean | null;
  source?: string | null;
  administered_on: string | null;
  next_due_on: string | null;
  vet_clinic: string | null;
  vaccine_type: string | null;
  duration_years: number | null;
  vet_name: string | null;
  vet_license: string | null;
  lot_number: string | null;
  lot_expires_on: string | null;
  manufacturer: string | null;
  injection_site: string | null;
  tag_number: string | null;
  is_booster: boolean | null;
  superseded: boolean | null;
  notes: string | null;
  document_url: string | null;
  clinic_id: string | null;
}

interface MedicalRecord {
  id: string;
  record_type: string | null;
  title: string | null;
  details: any;
  record_date: string | null;
  source?: string | null;
}

interface HistoryEvent {
  id: string;
  event_type: string;
  occurred_on: string | null;
  description: string | null;
  public_summary: string | null;
}

interface PetCondition {
  id: string;
  pet_id: string;
  kind: string;
  name: string;
  severity: string | null;
  diagnosed_on: string | null;
  resolved_on: string | null;
  notes: string | null;
  is_active: boolean;
  status?: string | null;
  onset_date?: string | null;
  resolved_date?: string | null;
  source_document_id?: string | null;
  source?: string | null;
  author_id?: string | null;
}

interface PetDiet {
  pet_id?: string;
  food_brand: string;
  food_product: string;
  food_type: string;
  portion: string;
  meals_per_day: number | null;
  treats: string;
  avoid: string;
  feeding_notes: string;
}

interface PetPhoto {
  id: string;
  pet_id: string;
  photo_url: string;
  sort_order: number;
  is_profile: boolean;
}

interface PetDocument {
  id: string;
  pet_id: string;
  kind: string;
  file_path: string;
  title: string | null;
  taken_on: string | null;
  clinic: string | null;
  notes: string | null;
  ai_summary?: any;
  ai_status?: string | null;
  content_kinds?: string[] | null;
}

interface ExtractedVaccination {
  vaccine: string | null;
  administered_on: string | null;
  next_due_on: string | null;
  duration_years: number | null;
  manufacturer: string | null;
  lot_number: string | null;
  lot_expires_on: string | null;
  injection_site: string | null;
  vaccine_type: string | null;
  tag_number: string | null;
  vet_name: string | null;
  vet_license: string | null;
  clinic_name: string | null;
}

interface ExtractedLabResult {
  analyte: string | null;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: string | null;
}

interface ExtractedLabPanel {
  panel_name: string | null;
  collected_on: string | null;
  clinic_name: string | null;
  vet_name: string | null;
  results: ExtractedLabResult[];
}

interface ExtractedWeight {
  value: number | null;
  unit: string | null;
  measured_on: string | null;
  originalValue?: number | null;
  originalUnit?: string | null;
}

interface ExtractedProcedure {
  event_type: string | null;
  occurred_on: string | null;
  title: string | null;
  notes: string | null;
  cost_cents: number | null;
}

interface ExtractedIdentity {
  microchip: string | null;
  date_of_birth: string | null;
  sex: string | null;
  breed: string | null;
  colors: string | null;
  bcs?: number | null;
}

interface ExtractedData {
  vaccinations: ExtractedVaccination[];
  lab_panels: ExtractedLabPanel[];
  weight: ExtractedWeight;
  procedures: ExtractedProcedure[];
  identity: ExtractedIdentity;
}

interface BreedOption {
  id: number;
  species: string;
  name: string;
  sort_order: number;
}

interface ColorOption {
  id: number;
  name: string;
  sort_order: number;
  hex?: string | null;
}

const COLOR_HEX: Record<string, string> = {
  black: '#2A2A33', white: '#F5F5F5', gray: '#9AA1AC', grey: '#9AA1AC',
  'blue / gray': '#6E7F95', 'blue-gray': '#6E7F95', blue: '#6E7F95',
  orange: '#E0893A', brown: '#7A5230', cream: '#EAD9B8',
  golden: '#D4A017', yellow: '#E5C35A', red: '#B54A3C', tan: '#C4A574',
  chocolate: '#5C3317', fawn: '#C9A86A', silver: '#9AA1AC',
};

function hexForColor(name?: string | null, fromDb?: string | null) {
  if (fromDb) return fromDb;
  if (!name) return '#9AA1AC';
  return COLOR_HEX[name.trim().toLowerCase()] || '#9AA1AC';
}

function ColorSwatches({ names, catalog }: { names: string[]; catalog: ColorOption[] }) {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  if (cleaned.some((n) => /tuxedo/i.test(n))) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#2A2A33', borderWidth: 1, borderColor: Colors.border }} />
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: Colors.border }} />
        <Text style={{ fontFamily: Fonts.semibold, fontSize: 12, color: Colors.navy }}>Tuxedo</Text>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {cleaned.map((n) => {
        const row = catalog.find((c) => c.name.toLowerCase() === n.toLowerCase());
        return <View key={n} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: hexForColor(n, row?.hex || null), borderWidth: 1, borderColor: Colors.border }} />;
      })}
      <Text style={{ fontFamily: Fonts.semibold, fontSize: 12, color: Colors.navy }}>{cleaned.join(' / ') || '—'}</Text>
    </View>
  );
}

function parseLocalParts(iso: string | null): { y: number; m: number; d: number } | null {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

function formatDate(value: string | null): string {
  const p = parseLocalParts(value);
  if (!p) return value ? String(value) : '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[p.m - 1]} ${p.d}, ${p.y}`;
}

function titleCase(value: string | null): string {
  if (!value) return '';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysUntil(dateStr: string | null): number | null {
  const p = parseLocalParts(dateStr);
  if (!p) return null;
  const d = new Date(p.y, p.m - 1, p.d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 864e5);
}

function vaccinationStatus(nextDue: string | null): 'overdue' | 'due-soon' | 'ok' | 'none' {
  if (!nextDue) return 'none';
  const days = daysUntil(nextDue);
  if (days === null) return 'none';
  if (days < 0) return 'overdue';
  if (days <= 30) return 'due-soon';
  return 'ok';
}

const CONDITION_CATEGORIES = [
  { key: 'condition', label: 'Condition' },
  { key: 'allergy', label: 'Allergy' },
  { key: 'medication', label: 'Medication' },
  { key: 'dietary_restriction', label: 'Dietary Restriction' },
  { key: 'behavioral', label: 'Behavioral' },
];

const SEVERITY_LEVELS = [
  { key: 'mild', label: 'Mild', color: Colors.teal },
  { key: 'moderate', label: 'Moderate', color: Colors.urgent },
  { key: 'severe', label: 'Severe', color: Colors.critical },
];

const FOOD_TYPES = [
  { key: 'dry', label: 'Dry' },
  { key: 'wet', label: 'Wet' },
  { key: 'raw', label: 'Raw' },
  { key: 'mixed', label: 'Mixed' },
  { key: 'prescription', label: 'Prescription' },
  { key: 'other', label: 'Other' },
];

const CONTENT_KINDS = [
  { key: 'vaccinations', label: 'Vaccinations' },
  { key: 'labs', label: 'Labs' },
  { key: 'exam_visit', label: 'Exam / visit' },
  { key: 'weight', label: 'Weight' },
  { key: 'medications', label: 'Medications' },
  { key: 'imaging', label: 'Imaging' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'other', label: 'Other' },
] as const;
const ALL_CONTENT_KIND_KEYS = CONTENT_KINDS.map((k) => k.key);

function kindFromContent(kinds: string[]) {
  if (kinds.length === 1) {
    if (kinds[0] === 'vaccinations') return 'vaccination_record';
    if (kinds[0] === 'labs') return 'lab_result';
    if (kinds[0] === 'imaging') return 'other_imaging';
    if (kinds[0] === 'insurance') return 'other_document';
  }
  return 'medical_record';
}

const LB_PER_KG = 2.20462;

function kgToLb(kg: number): number {
  return Math.round(kg * LB_PER_KG * 10) / 10;
}

function lbToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 100) / 100;
}

function relativeAgo(iso?: string | null) {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'just now';
  const h = Math.round(ms / 3600000);
  if (h < 1) return 'just now';
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function catalogBreed(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .replace(/domestic\s+shorthair/ig, 'American Shorthair')
    .replace(/\bDSH\b/g, 'American Shorthair')
    .replace(/domestic\s+longhair/ig, 'American Longhair')
    .replace(/\bDLH\b/g, 'American Longhair')
    .replace(/\s+/g, ' ')
    .trim();
}

function breedKey(raw?: string | null): string {
  return catalogBreed(raw).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function displayBreed(primary?: string | null, secondary?: string | null, fallback?: string | null): string {
  const p = catalogBreed(primary);
  const s = catalogBreed(secondary);
  if (p && s && breedKey(p) === breedKey(s)) return p;
  if (p && s) return `${p} / ${s}`;
  return p || s || catalogBreed(fallback) || '—';
}

function dedupeBreedPair(primary?: string | null, secondary?: string | null) {
  const p = catalogBreed(primary) || null;
  let s = catalogBreed(secondary) || null;
  if (s && p && breedKey(s) === breedKey(p)) s = null;
  return { primary: p, secondary: s };
}

function ageFromDob(dob?: string | null, ageText?: string | null) {
  const p = parseLocalParts(dob || null);
  if (p) {
    const born = new Date(p.y, p.m - 1, p.d).getTime();
    const y = (Date.now() - born) / (365.25 * 864e5);
    return `${Math.round(y * 10) / 10} y`;
  }
  return ageText || null;
}

function parseAnyDate(v: any): string | null {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const mdy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (mdy) {
    const a = parseInt(mdy[1], 10);
    const b = parseInt(mdy[2], 10);
    const y = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    let month = a;
    let day = b;
    if (a > 12 && b <= 12) { day = a; month = b; }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const named = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (named) {
    const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const mo = months[named[1].slice(0, 3).toLowerCase()];
    if (mo) return `${named[3]}-${mo}-${named[2].padStart(2, '0')}`;
  }
  return null;
}

function mapVaxRow(v: any) {
  const given = parseAnyDate(v.given || v.administered_on || v.administered_date || v.given_on || v.date_given);
  const due = parseAnyDate(v.next_due || v.next_due_on || v.valid_until || v.expires_on || v.due_date);
  const dateField = parseAnyDate(v.date);
  if (given && due) return given <= due ? { given, due } : { given: due, due: given };
  if (given) return { given, due: due || null };
  if (due && !given) return { given: null, due };
  if (dateField) return { given: dateField, due: null };
  return { given: null, due: null };
}

function ConfidenceDot({ level }: { level: 'high' | 'med' | 'low' | 'none' }) {
  const color = level === 'high' ? Colors.teal : level === 'med' ? Colors.accent : level === 'low' ? Colors.coral : Colors.textTertiary;
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
}

function StatusTile({
  icon: Icon,
  label,
  sub,
  tone,
  onPress,
  extraLink,
  extraOnPress,
}: {
  icon: any;
  label: string;
  sub: string;
  tone: 'ok' | 'due' | 'over' | 'unknown';
  onPress?: () => void;
  extraLink?: string;
  extraOnPress?: () => void;
}) {
  const tileBg = tone === 'ok' ? Colors.tealBg : tone === 'due' ? Colors.standardBg : tone === 'over' ? Colors.criticalBg : Colors.surface;
  const fg = tone === 'ok' ? Colors.teal : tone === 'due' ? Colors.accent : tone === 'over' ? Colors.critical : Colors.textTertiary;
  const inner = (
    <InnerTile style={[styles.statusTile, { backgroundColor: tileBg }]}>
      <View style={[styles.statusIcon, { backgroundColor: fg }]}>
        <Icon color={Colors.white} size={20} />
      </View>
      <Text style={[styles.statusLabel, { fontSize: 11 }]} numberOfLines={2}>{label}</Text>
      <View style={{ alignItems: 'center', justifyContent: 'center', gap: 2, width: '100%' }}>
        <Text style={[styles.statusSub, { color: fg, fontSize: 11 }]} numberOfLines={2}>{sub}</Text>
        {extraLink ? (
          <TouchableOpacity onPress={extraOnPress} hitSlop={8}>
            <Text style={styles.statusExtra}>{extraLink}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </InnerTile>
  );
  if (onPress) {
    return <TouchableOpacity style={styles.statusTileWrap} onPress={onPress} activeOpacity={0.85}>{inner}</TouchableOpacity>;
  }
  return <View style={styles.statusTileWrap}>{inner}</View>;
}

export default function PetRecordScreen() {
  const params = useLocalSearchParams<{ petId?: string; id?: string }>();
  const petId = params.petId || params.id || '';
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [pet, setPet] = useState<Pet | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [docKindFilter, setDocKindFilter] = useState<string | null>(null);
  const [openMed, setOpenMed] = useState<Record<string, boolean>>({ vaccinations: true });
  const [examNote, setExamNote] = useState<string | null>(null);
  const [petExams, setPetExams] = useState<any[]>([]);
  const [medsGiven, setMedsGiven] = useState<any[]>([]);
  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [vitalRows, setVitalRows] = useState<any[]>([]);
  const [detailsCoat, setDetailsCoat] = useState('');
  const [aiFindings, setAiFindings] = useState<any>(null);
  const [aiRuns, setAiRuns] = useState<any[]>([]);
  const [aiShared, setAiShared] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiLastRun, setAiLastRun] = useState<string | null>(null);
  const [weightEntries, setWeightEntries] = useState<{ weight_lb: number; measured_on: string | null; source?: string | null }[]>([]);
  const [labRows, setLabRows] = useState<any[]>([]);
  const [labSpark, setLabSpark] = useState<string | null>(null);
  const [deviceReadings, setDeviceReadings] = useState<any[]>([]);
  const [petDevices, setPetDevices] = useState<any[]>([]);
  const [chipNumber, setChipNumber] = useState<string | null>(null);
  const [chipDenied, setChipDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([]);
  const [conditions, setConditions] = useState<PetCondition[]>([]);
  const [diet, setDiet] = useState<PetDiet | null>(null);
  const [photos, setPhotos] = useState<PetPhoto[]>([]);
  const [documents, setDocuments] = useState<PetDocument[]>([]);
  const [breeds, setBreeds] = useState<BreedOption[]>([]);
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('lb');
  const [canEdit, setCanEdit] = useState(false);
  const [canCare, setCanCare] = useState(false);
  const [isPetOwner, setIsPetOwner] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);

  const [vaxModalVisible, setVaxModalVisible] = useState(false);
  const [editingVax, setEditingVax] = useState<FullVaccination | null>(null);
  const [clinics, setClinics] = useState<ClinicInfo[]>([]);

  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [editingCondition, setEditingCondition] = useState<PetCondition | null>(null);
  const [conditionForm, setConditionForm] = useState({
    kind: 'condition', name: '', severity: 'mild', diagnosed_on: '', resolved_on: '', notes: '', is_active: true,
  });
  const [savingCondition, setSavingCondition] = useState(false);

  const [dietModalVisible, setDietModalVisible] = useState(false);
  const [dietForm, setDietForm] = useState<PetDiet>({
    food_brand: '', food_product: '', food_type: '', portion: '',
    meals_per_day: 2, treats: '', avoid: '', feeding_notes: '',
  });
  const [savingDiet, setSavingDiet] = useState(false);

  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightUnitLocal, setWeightUnitLocal] = useState<'kg' | 'lb'>('lb');
  const [bcsInput, setBcsInput] = useState<number | null>(null);
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  const [breedModalVisible, setBreedModalVisible] = useState(false);
  const [breedForm, setBreedForm] = useState({
    breed_primary: '', breed_secondary: '', is_mixed: false, breed_notes: '',
  });
  const [breedSearch, setBreedSearch] = useState('');
  const [selectingBreedField, setSelectingBreedField] = useState<'primary' | 'secondary' | null>(null);
  const [savingBreed, setSavingBreed] = useState(false);

  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [colorForm, setColorForm] = useState({
    primary_color: '', secondary_color: '', color_notes: '',
  });
  const [selectingColorField, setSelectingColorField] = useState<'primary' | 'secondary' | null>(null);
  const [savingColor, setSavingColor] = useState(false);
  const [detailsSheetVisible, setDetailsSheetVisible] = useState(false);
  const [detailsDob, setDetailsDob] = useState('');
  const [detailsSex, setDetailsSex] = useState('');
  const [detailsSpayed, setDetailsSpayed] = useState(false);
  const [detailsSince, setDetailsSince] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const [docModalVisible, setDocModalVisible] = useState(false);
  const [docForm, setDocForm] = useState({
    kind: 'medical_record', title: '', taken_on: '', clinic: '', notes: '',
    content_kinds: ALL_CONTENT_KIND_KEYS.slice(),
  });
  const [docFile, setDocFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [extractionReview, setExtractionReview] = useState<{
    documentId: string;
    data: ExtractedData;
    extractionId: string;
    vaxDuplicates: Set<number>;
    conditions: { name: string; kind?: string; notes?: string; status?: string; onset_date?: string; resolved_date?: string }[];
    visitsCount: number;
    labsCount: number;
    weightsCount?: number;
    pageCount?: number;
    exams?: any[];
  } | null>(null);
  const parsedAttempted = useRef<Set<string>>(new Set());
  const [editableVax, setEditableVax] = useState<ExtractedVaccination[]>([]);
  const [editableLabs, setEditableLabs] = useState<ExtractedLabPanel[]>([]);
  const [editableWeight, setEditableWeight] = useState<ExtractedWeight>({ value: null, unit: null, measured_on: null });
  const [editableWeights, setEditableWeights] = useState<ExtractedWeight[]>([]);
  const [editableProcedures, setEditableProcedures] = useState<ExtractedProcedure[]>([]);
  const [applyingExtraction, setApplyingExtraction] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState<Set<string>>(new Set());
  const [parseProgress, setParseProgress] = useState<string | null>(null);
  const [openVaxHist, setOpenVaxHist] = useState<Set<string>>(new Set());
  const [vaxCatalog, setVaxCatalog] = useState<CatalogRow[]>([]);
  const [labCatalog, setLabCatalog] = useState<CatalogRow[]>([]);
  const [condCatalog, setCondCatalog] = useState<CatalogRow[]>([]);
  const [medCatalog, setMedCatalog] = useState<CatalogRow[]>([]);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);

  const showBanner = (message: string, kind: 'error' | 'success' | 'info' = 'error') => {
    setBanner({ message, kind });
    if (kind === 'error') console.error('[pet-record]', message);
    setTimeout(() => setBanner(null), 5000);
  };

  const load = useCallback(async () => {
    if (!petId || !user) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    const petRes = await supabase
      .from('pets')
      .select('id, name, breed, species, age_text, gender, status, description, main_photo_url, location, shelter_id, owner_id, vaccinated, spayed_neutered, microchipped, weight_kg, weight_measured_on, primary_color, secondary_color, color_notes, breed_primary, breed_secondary, is_mixed, breed_notes, date_of_birth, body_condition_score, target_weight_kg, previous_names, coat, ai_traits')
      .eq('id', petId)
      .maybeSingle();

    let petData = petRes.data;
    let petErr = petRes.error;
    if (petErr && /coat/i.test(petErr.message || '')) {
      const retry = await supabase.from('pets').select('id, name, breed, species, age_text, gender, status, description, main_photo_url, location, shelter_id, owner_id, vaccinated, spayed_neutered, microchipped, weight_kg, weight_measured_on, primary_color, secondary_color, color_notes, breed_primary, breed_secondary, is_mixed, breed_notes, date_of_birth, body_condition_score, target_weight_kg, previous_names, ai_traits').eq('id', petId).maybeSingle();
      petData = retry.data as typeof petData; petErr = retry.error;
    }
    if (petErr || !petData) {
      setError('Could not load this pet record.');
      setLoading(false);
      return;
    }
    setPet(petData);
    setLoading(false);

    const isOwner = petData.owner_id === user.id;
    const { data: myRels } = await supabase
      .from('pet_relationships')
      .select('id, relationship, ended_on')
      .eq('pet_id', petId)
      .eq('user_id', user.id)
      .is('ended_on', null);
    const rels = (myRels || []).map((r) => (r.relationship || '').toLowerCase());
    const isCoOwner = rels.some((r) => r === 'co_owner' || r === 'co-owner' || r === 'owner' || r === 'own');
    const isCurrentFoster = rels.includes('foster') || rels.includes('caretaker');

    let isOrgStaff = false;
    if (petData.shelter_id) {
      const { data: sm } = await supabase
        .from('shelter_members')
        .select('shelter_id')
        .eq('shelter_id', petData.shelter_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (sm) isOrgStaff = true;
      const { data: om } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('organization_id', petData.shelter_id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (om) isOrgStaff = true;
    }
    setCanEdit(isOwner || isCoOwner || isOrgStaff);
    setCanCare(isOwner || isCoOwner || isCurrentFoster || isOrgStaff);
    setIsPetOwner(isOwner);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('weight_unit')
      .eq('id', user.id)
      .maybeSingle();
    if (profileData?.weight_unit) setWeightUnit(profileData.weight_unit as 'kg' | 'lb');

    const [relsRes, vaxRes, medRes, histRes, condRes, dietRes, photosRes, docsRes, breedsRes, colorsRes] = await Promise.all([
      supabase.from('pet_relationships')
        .select('id, user_id, relationship, started_on, ended_on, notes')
        .eq('pet_id', petId)
        .order('started_on', { ascending: false }),
      supabase.from('pet_vaccinations')
        .select('*')
        .eq('pet_id', petId)
        .order('administered_on', { ascending: false }),
      supabase.from('medical_records')
        .select('id, record_type, title, details, record_date, source, author_id')
        .eq('pet_id', petId)
        .order('record_date', { ascending: false }),
      supabase.from('pet_history_events')
        .select('id, event_type, occurred_on, description, public_summary')
        .eq('pet_id', petId)
        .order('occurred_on', { ascending: false }),
      supabase.from('pet_conditions')
        .select('id, pet_id, kind, name, severity, diagnosed_on, resolved_on, notes, is_active, status, onset_date, resolved_date, source_document_id, source, author_id')
        .eq('pet_id', petId)
        .order('is_active', { ascending: false }),
      supabase.from('pet_diet')
        .select('pet_id, food_brand, food_product, food_type, portion, meals_per_day, treats, avoid, feeding_notes')
        .eq('pet_id', petId)
        .maybeSingle(),
      supabase.from('pet_photos')
        .select('id, pet_id, photo_url, sort_order, is_profile')
        .eq('pet_id', petId)
        .order('sort_order', { ascending: true }),
      supabase.from('pet_documents')
        .select('*')
        .eq('pet_id', petId)
        .order('created_at', { ascending: false }),
      supabase.from('pet_breeds').select('id, species, name, sort_order').order('species').order('sort_order'),
      supabase.from('pet_colors').select('id, name, sort_order, hex').order('sort_order'),
    ]);

    if (relsRes.data) {
      const userIds = [...new Set(relsRes.data.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      const nameMap: Record<string, string> = {};
      profiles?.forEach((p) => { nameMap[p.id] = p.full_name || 'Unknown'; });
      setRelationships(relsRes.data.map((r) => ({ ...r, profile_name: nameMap[r.user_id] || 'Unknown' })));
    }

    const vaxRows = ((vaxRes.data as Vaccination[]) || []).filter((v) => v.administered_on);
    if (((vaxRes.data as Vaccination[]) || []).some((v) => !v.administered_on)) {
      await supabase.from('pet_vaccinations').delete().eq('pet_id', petId).is('administered_on', null);
    }
    setVaccinations(vaxRows);

    const { data: clinicData } = await supabase.from('vet_clinics').select('id, name, address, phone, website').order('name');
    setClinics((clinicData as ClinicInfo[]) || []);
    const [vaxCat, labCat, condCat, medCat] = await Promise.all([
      supabase.from('vaccine_products').select('*').order('name'),
      supabase.from('lab_analytes').select('*').order('name'),
      supabase.from('condition_catalog').select('*').order('name'),
      supabase.from('medications').select('*').order('name'),
    ]);
    if (!vaxCat.error && vaxCat.data) setVaxCatalog(vaxCat.data as CatalogRow[]);
    if (!labCat.error && labCat.data) setLabCatalog(labCat.data as CatalogRow[]);
    if (!condCat.error && condCat.data) setCondCatalog(condCat.data as CatalogRow[]);
    if (!medCat.error && medCat.data) setMedCatalog(medCat.data as CatalogRow[]);
    setMedicalRecords((medRes.data as MedicalRecord[]) || []);
    setHistoryEvents((histRes.data as HistoryEvent[]) || []);
    setConditions((condRes.data as PetCondition[]) || []);
    setDiet((dietRes.data as PetDiet) || null);
    const gallery = (photosRes.data as PetPhoto[]) || [];
    setPhotos(gallery);
    const petPhoto = petData?.main_photo_url;
    if (!isUsablePhoto(petPhoto)) {
      const good = gallery.find((g) => isUsablePhoto(g.photo_url));
      if (good && petId) {
        await supabase.from('pets').update({ main_photo_url: good.photo_url }).eq('id', petId);
        setPet((cur) => cur ? { ...cur, main_photo_url: good.photo_url } : cur);
      }
    }
    if (docsRes.error) console.error('[pet-record] documents', docsRes.error);
    const mappedDocs = ((docsRes.data as any[]) || []).map((d) => ({
      id: d.id,
      pet_id: d.pet_id,
      kind: d.kind,
      file_path: d.file_path || d.storage_path || '',
      title: d.title,
      taken_on: d.taken_on,
      clinic: d.clinic,
      notes: d.notes,
      ai_summary: d.ai_summary || d.extracted || null,
      ai_status: d.ai_status || null,
      content_kinds: Array.isArray(d.content_kinds) ? d.content_kinds : null,
    }));
    const seenPath = new Set<string>();
    setDocuments(mappedDocs.filter((d) => {
      const key = d.file_path || d.id;
      if (seenPath.has(key)) return false;
      seenPath.add(key);
      return true;
    }));
    setBreeds((breedsRes.data as BreedOption[]) || []);
    setColors((colorsRes.data as ColorOption[]) || []);
    if (colorsRes.error) {
      const { data: c2 } = await supabase.from('pet_colors').select('id, name, sort_order');
      setColors((c2 as ColorOption[]) || []);
    }
    const [wRes, labRes, devRes, aiRes, deviceRes, chipRes, examRes, medsRes, diagRes, vitRes] = await Promise.all([
      supabase.from('weight_entries').select('weight_lb, measured_on, source, created_at, author_id').eq('pet_id', petId).order('measured_on', { ascending: false }).limit(40),
      supabase.from('lab_results').select('*').eq('pet_id', petId).order('created_at', { ascending: false }).limit(400),
      supabase.from('device_readings').select('*').eq('pet_id', petId).order('recorded_at', { ascending: false }).limit(80),
      supabase.from('ai_health_analyses').select('*').eq('pet_id', petId).order('created_at', { ascending: false }).limit(20),
      supabase.from('pet_devices').select('*').eq('pet_id', petId),
      supabase.from('pet_identifiers').select('microchip_number').eq('pet_id', petId).maybeSingle(),
      supabase.from('pet_exams').select('*').eq('pet_id', petId).order('visit_date', { ascending: false }).limit(20),
      supabase.from('medications_given').select('*').eq('pet_id', petId).order('administered_on', { ascending: false }).limit(40),
      supabase.from('pet_diagnostics').select('*').eq('pet_id', petId).order('taken_on', { ascending: false }).limit(40),
      supabase.from('pet_vitals').select('*').eq('pet_id', petId).order('recorded_at', { ascending: true }).limit(200),
    ]);
    setWeightEntries((wRes.data as any[]) || []);
    let labs = (labRes.data as any[]) || [];
    if (!labs.length) {
      const { data: panels } = await supabase.from('lab_panels').select('id, collected_on').eq('pet_id', petId);
      if (panels?.length) {
        const { data: rows } = await supabase.from('lab_results').select('*').in('panel_id', panels.map((p) => p.id));
        labs = (rows || []).map((r: any) => ({
          ...r,
          pet_id: petId,
          collected_on: r.collected_on || panels.find((p) => p.id === r.panel_id)?.collected_on,
        }));
      }
    }
    setLabRows(labs.map((r: any) => ({
      ...r,
      analyte: r.analyte || r.name,
      value_text: r.value_text || r.value,
      value_num: r.value_numeric ?? r.value_num,
    })));
    setDeviceReadings((devRes.data as any[]) || []);
    setPetDevices((deviceRes.data as any[]) || []);
    if (!examRes.error) setPetExams((examRes.data as any[]) || []);
    if (!medsRes.error) setMedsGiven((medsRes.data as any[]) || []);
    if (!diagRes.error) setDiagnostics((diagRes.data as any[]) || []);
    if (!vitRes.error) setVitalRows((vitRes.data as any[]) || []);
    if (chipRes.error) setChipDenied(true);
    else setChipNumber(chipRes.data?.microchip_number || null);
    const runs = (aiRes.data as any[]) || [];
    setAiRuns(runs);
    if (runs[0]) {
      const row = runs[0];
      setAiFindings({
        id: row.id,
        run_number: row.run_number,
        verdict: row.verdict || row.inputs?.verdict,
        findings: row.findings,
        timeline: row.timeline || row.inputs?.timeline,
        trends: row.trends || row.inputs?.trends,
        conclusion: row.conclusion || row.inputs?.conclusion || row.summary,
        summary: row.summary,
        ran_at: row.created_at,
      });
      setAiLastRun(row.created_at);
      setAiShared(Boolean(row.shared_with_vet_at));
    }
    setLoading(false);
  }, [petId, user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!canEdit) return;
    for (const d of documents) {
      const st = d.ai_status || 'pending';
      if (parsedAttempted.current.has(d.id)) continue;
      if (st === 'processing' || st === 'ready' || st === 'confirmed' || st === 'parsed' || st === 'missing_file') continue;
      const ver = d.ai_summary && typeof d.ai_summary === 'object' ? Number((d.ai_summary as any).schemaVersion) || 0 : 0;
      if (ver >= 2) continue;
      if (st !== 'pending' && st !== 'failed') continue;
      parsedAttempted.current.add(d.id);
      void triggerExtraction(d.id, { path: d.file_path }, true);
    }
  }, [documents, canEdit]);

  // === Vaccination handlers ===
  const openAddVax = () => {
    setEditingVax(null);
    setVaxModalVisible(true);
  };

  const openEditVax = (vax: Vaccination) => {
    setEditingVax(vax as FullVaccination);
    setVaxModalVisible(true);
  };

  const deleteVax = (id: string) => {
    setConfirmConfig({
      title: 'Delete vaccination?',
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from('pet_vaccinations').delete().eq('id', id);
        if (error) { console.error('[pet-record] vax delete:', error); showBanner('Could not delete vaccination.'); return; }
        load();
      },
    });
  };

  // === Condition handlers ===
  const openAddCondition = () => {
    setEditingCondition(null);
    setConditionForm({ kind: 'condition', name: '', severity: 'mild', diagnosed_on: '', resolved_on: '', notes: '', is_active: true });
    setConditionModalVisible(true);
  };

  const openEditCondition = (c: PetCondition) => {
    setEditingCondition(c);
    setConditionForm({
      kind: c.kind,
      name: c.name,
      severity: c.severity || 'mild',
      diagnosed_on: c.diagnosed_on || '',
      resolved_on: c.resolved_on || '',
      notes: c.notes || '',
      is_active: c.is_active,
    });
    setConditionModalVisible(true);
  };

  const saveCondition = async () => {
    if (!petId || !user || !conditionForm.name.trim()) return;
    setSavingCondition(true);
    const payload = {
      pet_id: petId,
      kind: conditionForm.kind,
      name: conditionForm.name.trim(),
      severity: conditionForm.severity,
      diagnosed_on: conditionForm.diagnosed_on || null,
      resolved_on: conditionForm.is_active ? null : (conditionForm.resolved_on || null),
      notes: conditionForm.notes.trim() || null,
      is_active: conditionForm.is_active,
      source: 'owner',
      author_id: user.id,
    };
    if (editingCondition) {
      const { error } = await supabase.from('pet_conditions').update(payload).eq('id', editingCondition.id);
      if (error) { console.error('[pet-record] condition update:', error); showBanner(error.message || 'Could not update.'); setSavingCondition(false); return; }
    } else {
      const { error } = await supabase.from('pet_conditions').insert(payload);
      if (error) { console.error('[pet-record] condition insert:', error); showBanner(error.message || 'Could not add condition.'); setSavingCondition(false); return; }
    }
    setSavingCondition(false);
    setConditionModalVisible(false);
    load();
  };

  const deleteCondition = (id: string) => {
    setConfirmConfig({
      title: 'Delete entry?',
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from('pet_conditions').delete().eq('id', id);
        if (error) { console.error('[pet-record] condition delete:', error); showBanner(error.message || 'Could not delete entry.'); return; }
        load();
      },
    });
  };

  // === Diet handlers ===
  const openEditDiet = () => {
    setDietForm({
      food_brand: diet?.food_brand || '',
      food_product: diet?.food_product || '',
      food_type: diet?.food_type || '',
      portion: diet?.portion || '',
      meals_per_day: diet?.meals_per_day ?? 2,
      treats: diet?.treats || '',
      avoid: diet?.avoid || '',
      feeding_notes: diet?.feeding_notes || '',
    });
    setDietModalVisible(true);
  };

  const saveDiet = async () => {
    if (!petId || !user) return;
    setSavingDiet(true);
    const payload = {
      pet_id: petId,
      food_brand: dietForm.food_brand.trim() || null,
      food_product: dietForm.food_product.trim() || null,
      food_type: dietForm.food_type || null,
      portion: dietForm.portion.trim() || null,
      meals_per_day: dietForm.meals_per_day || null,
      treats: dietForm.treats.trim() || null,
      avoid: dietForm.avoid.trim() || null,
      feeding_notes: dietForm.feeding_notes.trim() || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    if (diet?.pet_id) {
      const { error } = await supabase.from('pet_diet').update(payload).eq('pet_id', petId);
      if (error) { console.error('[pet-record] diet update:', error); showBanner(error.message || 'Could not save diet.'); setSavingDiet(false); return; }
    } else {
      const { error } = await supabase.from('pet_diet').insert(payload);
      if (error) { console.error('[pet-record] diet insert:', error); showBanner(error.message || 'Could not save diet.'); setSavingDiet(false); return; }
    }
    setSavingDiet(false);
    setDietModalVisible(false);
    load();
  };

  // === Weight handlers ===
  const openWeight = () => {
    const currentKg = pet?.weight_kg;
    if (currentKg != null) {
      setWeightInput(weightUnit === 'lb' ? String(kgToLb(currentKg)) : String(Math.round(currentKg * 100) / 100));
    } else {
      setWeightInput('');
    }
    if (pet?.body_condition_score != null) setBcsInput(pet.body_condition_score);
    if (pet?.target_weight_kg != null) setTargetWeightInput(weightUnit === 'lb' ? String(kgToLb(pet.target_weight_kg)) : String(Math.round(pet.target_weight_kg * 100) / 100));
    setWeightUnitLocal(weightUnit);
    setWeightModalVisible(true);
  };

  const BCS_DESCRIPTIONS = [
    'Emaciated — Ribs, vertebrae, pelvic bones prominent. Obvious loss of muscle mass.',
    'Very thin — Ribs easily palpated, minimal fat. Prominent pelvic bones.',
    'Thin — Ribs palpated with slight pressure. Minimal fat over bony prominences.',
    'Underweight — Ribs palpable with minimal pressure. Slight fat covering.',
    'Ideal — Ribs palpable without excess fat covering. Well-proportioned.',
    'Overweight — Ribs palpable with slight excess fat covering. Waist barely visible.',
    'Heavy — Ribs difficult to palpate through fat. Waist absent or barely visible.',
    'Obese — Ribs not palpable under thick fat. No waist, obvious abdominal distension.',
    'Morbidly obese — Massive fat deposits. Abdominal distension prominent.',
  ];

  const saveWeight = async () => {
    if (!petId || !user) return;
    const num = parseFloat(weightInput);
    if (isNaN(num) || num <= 0) { showBanner('Please enter a valid weight number.'); return; }
    setSavingWeight(true);
    const kg = weightUnitLocal === 'lb' ? lbToKg(num) : Math.round(num * 100) / 100;
    const today = new Date().toISOString().slice(0, 10);
    const { error: petErr } = await supabase
      .from('pets')
      .update({
        weight_kg: kg,
        weight_measured_on: today,
        body_condition_score: bcsInput,
        target_weight_kg: targetWeightInput ? (weightUnitLocal === 'lb' ? lbToKg(parseFloat(targetWeightInput)) : parseFloat(targetWeightInput)) : null,
      })
      .eq('id', petId);
    if (petErr) { console.error('[pet-record] weight update:', petErr); showBanner(petErr.message || 'Could not save weight.'); setSavingWeight(false); return; }
    await supabase.from('weight_entries').insert({
      pet_id: petId,
      weight_lb: weightUnitLocal === 'lb' ? num : kgToLb(kg),
      measured_on: today,
      source: 'owner',
      author_id: user.id,
    });
    await supabase.from('pet_care_events').insert({
      pet_id: petId,
      event_type: 'weight',
      occurred_on: today,
      title: 'Weight recorded',
      notes: `${weightUnitLocal === 'lb' ? kgToLb(kg) : kg} ${weightUnitLocal}`,
      weight_kg: kg,
      recorded_by: user.id,
    });
    setSavingWeight(false);
    setWeightModalVisible(false);
    load();
  };

  // === Breed handlers ===
  const openBreedModal = () => {
    setBreedForm({
      breed_primary: pet?.breed_primary || '',
      breed_secondary: pet?.breed_secondary || '',
      is_mixed: pet?.is_mixed ?? false,
      breed_notes: pet?.breed_notes || '',
    });
    setBreedModalVisible(true);
  };

  const saveBreed = async () => {
    if (!petId) return;
    setSavingBreed(true);
    const pair = dedupeBreedPair(breedForm.breed_primary, breedForm.breed_secondary);
    const { error } = await supabase
      .from('pets')
      .update({
        breed_primary: pair.primary,
        breed_secondary: pair.secondary,
        is_mixed: pair.secondary ? true : breedForm.is_mixed,
        breed_notes: breedForm.breed_notes.trim() || null,
        breed: pair.primary,
      })
      .eq('id', petId);
    if (error) { console.error('[pet-record] breed update:', error); showBanner(error.message || 'Could not save breed info.'); setSavingBreed(false); return; }
    setSavingBreed(false);
    setBreedModalVisible(false);
    load();
  };

  // === Color handlers ===
  const openDetailsSheet = () => {
    setBreedForm({
      breed_primary: pet?.breed_primary || '',
      breed_secondary: pet?.breed_secondary || '',
      is_mixed: pet?.is_mixed ?? false,
      breed_notes: pet?.breed_notes || '',
    });
    setColorForm({
      primary_color: pet?.primary_color || '',
      secondary_color: pet?.secondary_color || '',
      color_notes: pet?.color_notes || '',
    });
    setDetailsDob(pet?.date_of_birth || '');
    setDetailsSex(pet?.gender || '');
    setDetailsSpayed(Boolean(pet?.spayed_neutered));
    setDetailsCoat(pet?.coat || pet?.ai_traits?.coat || inferCoat(pet?.breed_primary || pet?.breed, pet?.breed_notes) || '');
    const ownerRel = (relationships || []).find((r) =>
      !r.ended_on && /owner/i.test(r.relationship || '') && (!pet?.owner_id || r.user_id === pet.owner_id)
    ) || (relationships || []).find((r) => !r.ended_on && /owner/i.test(r.relationship || ''));
    setDetailsSince((ownerRel?.started_on || '').slice(0, 10));
    setDetailsSheetVisible(true);
  };

  const saveDetails = async () => {
    if (!petId) return;
    setSavingDetails(true);
    const pair = dedupeBreedPair(breedForm.breed_primary, breedForm.breed_secondary);
    const { error } = await supabase.from('pets').update({
      breed_primary: pair.primary,
      breed_secondary: pair.secondary,
      is_mixed: pair.secondary ? true : breedForm.is_mixed,
      breed_notes: breedForm.breed_notes.trim() || null,
      breed: pair.primary,
      primary_color: colorForm.primary_color || null,
      secondary_color: colorForm.secondary_color || null,
      color_notes: colorForm.color_notes.trim() || null,
      date_of_birth: detailsDob || null,
      gender: detailsSex || null,
      spayed_neutered: detailsSpayed,
      coat: detailsCoat || null,
    }).eq('id', petId);
    if (!error && detailsSince) {
      const ownerRel = (relationships || []).find((r) =>
        !r.ended_on && /owner/i.test(r.relationship || '') && (!pet?.owner_id || r.user_id === pet.owner_id)
      ) || (relationships || []).find((r) => !r.ended_on && /owner/i.test(r.relationship || ''));
      const since = detailsSince.slice(0, 10);
      if (ownerRel?.id) {
        const { error: relErr } = await supabase.from('pet_relationships').update({ started_on: since }).eq('id', ownerRel.id);
        if (relErr) showBanner(relErr.message || 'Saved details, but With you since did not persist.');
      } else if (pet?.owner_id) {
        const { error: relErr } = await supabase.from('pet_relationships').insert({
          pet_id: petId, user_id: pet.owner_id, relationship: 'owner', started_on: since, source: 'owner',
        });
        if (relErr) {
          await supabase.from('pet_relationships').insert({
            pet_id: petId, user_id: pet.owner_id, relationship: 'owner', started_on: since,
          });
        }
      }
    }
    setSavingDetails(false);
    if (error) { showBanner(error.message || 'Could not save details.'); return; }
    setDetailsSheetVisible(false);
    load();
  };

  const saveColor = async () => {
    if (!petId) return;
    setSavingColor(true);
    const { error } = await supabase
      .from('pets')
      .update({
        primary_color: colorForm.primary_color || null,
        secondary_color: colorForm.secondary_color || null,
        color_notes: colorForm.color_notes.trim() || null,
      })
      .eq('id', petId);
    if (error) { console.error('[pet-record] color update:', error); showBanner(error.message || 'Could not save color info.'); setSavingColor(false); return; }
    setSavingColor(false);
    setColorModalVisible(false);
    load();
  };

  // === Photo handlers ===
  const uploadPhoto = async () => {
    if (!petId || !user || photos.length >= 10) return;
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        setPhotoUploading(true);
        const prepared = await prepareImageFile(file);
        const filePath = `${petId}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from('pet-photos').upload(filePath, prepared.blob, { contentType: 'image/jpeg', upsert: true });
        if (upErr) { console.error('[pet-record] photo upload (web):', upErr); showBanner('Could not upload photo.'); setPhotoUploading(false); return; }
        const { error: insErr } = await supabase.from('pet_photos').insert({
          pet_id: petId,
          photo_url: filePath,
          sort_order: photos.length,
          is_profile: true,
          uploaded_by: user.id,
        });
        if (insErr) { console.error('[pet-record] photo insert (web):', insErr); }
        await supabase.from('pets').update({ main_photo_url: filePath }).eq('id', petId);
        setPhotoUploading(false);
        load();
      };
      input.click();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoUploading(true);
    const resp = await fetch(asset.uri);
    const blob = await resp.blob();
    const file = new File([blob], 'pet.jpg', { type: 'image/jpeg' });
    const prepared = await prepareImageFile(file);
    const filePath = `${petId}/${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from('pet-photos').upload(filePath, prepared.blob, { contentType: 'image/jpeg', upsert: true });
    if (upErr) { console.error('[pet-record] photo upload:', upErr); showBanner('Could not upload photo.'); setPhotoUploading(false); return; }
    const { error: insErr } = await supabase.from('pet_photos').insert({
      pet_id: petId,
      photo_url: filePath,
      sort_order: photos.length,
      is_profile: true,
      uploaded_by: user.id,
    });
    if (insErr) { console.error('[pet-record] photo insert:', insErr); }
    await supabase.from('pets').update({ main_photo_url: filePath }).eq('id', petId);
    setPhotoUploading(false);
    load();
  };

  const setProfilePhoto = async (photo: PetPhoto) => {
    if (!petId) return;
    await supabase.from('pet_photos').update({ is_profile: false }).eq('pet_id', petId);
    await supabase.from('pet_photos').update({ is_profile: true }).eq('id', photo.id);
    await supabase.from('pets').update({ main_photo_url: photo.photo_url }).eq('id', petId);
    load();
  };

  const deletePhoto = (photo: PetPhoto) => {
    if (!petId) return;
    setConfirmConfig({
      title: 'Delete photo?',
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from('pet_photos').delete().eq('id', photo.id);
        if (error) { console.error('[pet-record] photo delete:', error); showBanner('Could not delete photo.'); return; }
        if (photo.is_profile) {
          const remaining = photos.filter((p) => p.id !== photo.id);
          if (remaining.length > 0) {
            await supabase.from('pet_photos').update({ is_profile: true }).eq('id', remaining[0].id);
            await supabase.from('pets').update({ main_photo_url: remaining[0].photo_url }).eq('id', petId);
          } else {
            await supabase.from('pets').update({ main_photo_url: null }).eq('id', petId);
          }
        }
        load();
      },
    });
  };

  // === Document handlers ===
  const openAddDoc = () => {
    setDocForm({
      kind: 'medical_record', title: '', taken_on: '', clinic: '', notes: '',
      content_kinds: ALL_CONTENT_KIND_KEYS.slice(),
    });
    setDocFile(null);
    setDocError(null);
    setDocKindFilter(null);
    setTab('documents');
    setDocModalVisible(true);
  };

  const pickDocFile = async () => {
    setDocError(null);
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          setDocFile({
            uri: URL.createObjectURL(file),
            name: file.name,
            mimeType: file.type,
            fileSize: file.size,
            file,
          } as any);
          setDocForm((p) => ({ ...p, title: p.title.trim() ? p.title : file.name }));
        }
      };
      input.click();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setDocFile(result.assets[0]);
      const name = originalFileName(result.assets[0]);
      setDocForm((p) => ({ ...p, title: p.title.trim() ? p.title : name }));
    }
  };

  const saveDoc = async () => {
    const fail = (message: string, extra?: { path?: string | null; size?: number | null; error?: any }) => {
      const line = {
        bucket: 'pet-documents',
        path: extra?.path ?? null,
        size: extra?.size ?? (docFile as any)?.fileSize ?? null,
        error: extra?.error ?? message,
      };
      console.error('[upload]', line);
      setDocError(message);
      showBanner(message);
    };
    if (!docFile) { fail('Choose a file first.'); return; }
    if (!petId) { fail('Missing pet id.'); return; }
    if (!user) { fail('Sign in to upload.'); return; }
    setDocError(null);
    setSavingDoc(true);
    let dest = '';
    let size = 0;
    try {
      const originalName = originalFileName(docFile);
      const mimeGuess = String((docFile as any).mimeType || (docFile as any).type || '');
      const nativeFile: File | undefined = (docFile as any).file;
      if (!nativeFile && !docFile.uri) throw new Error('No file selected.');
      const blob: Blob = nativeFile || await (await fetch(docFile.uri)).blob();
      const isPdf = /pdf/i.test(mimeGuess) || /\.pdf$/i.test(originalName) || /pdf/i.test(blob.type);
      let body: Blob = blob;
      let contentType = blob.type || mimeGuess || (isPdf ? 'application/pdf' : 'image/jpeg');
      let ext = (originalName.split('.').pop() || '').toLowerCase();
      if (!isPdf && (blob.size > 1_500_000 || /image\//i.test(contentType))) {
        try {
          const file = nativeFile || (typeof File !== 'undefined' ? new File([blob], originalName, { type: contentType }) : null);
          if (file && file.size > 1_500_000) {
            const prepared = await prepareImageFile(file as File);
            body = prepared.blob;
            contentType = prepared.mediaType;
            ext = 'jpg';
          }
        } catch (e) {
          console.warn('[upload] image compress skipped', e);
        }
      }
      if (!ext || ext.length > 5) ext = isPdf ? 'pdf' : 'jpg';
      const ts = Date.now();
      const dests = [`${petId}/${ts}.${ext}`, `${user.id}/${ts}.${ext}`];
      size = body.size;
      let up: { data: { path?: string } | null; error: { message?: string } | null } = { data: null, error: { message: 'not attempted' } };
      for (let i = 0; i < dests.length; i++) {
        dest = dests[i];
        console.log('[upload]', { bucket: 'pet-documents', path: dest, size, error: null, attempt: i + 1 });
        up = await supabase.storage.from('pet-documents').upload(dest, body, { contentType, upsert: false });
        if (up.error && Platform.OS !== 'web') {
          console.warn('[upload] arrayBuffer upload failed, retrying FormData', {
            message: up.error.message,
            name: (up.error as any).name,
            statusCode: (up.error as any).statusCode,
          });
          const fd = new FormData();
          fd.append('file', { uri: docFile.uri, type: contentType, name: dest.split('/').pop() || originalName } as any);
          up = await supabase.storage.from('pet-documents').upload(dest, fd as any, { contentType, upsert: true });
        }
        if (!up.error) break;
        console.warn('[upload]', { bucket: 'pet-documents', path: dest, size, error: up.error.message, attempt: i + 1 });
        if (!/row-level security|security policy/i.test(up.error.message || '')) break;
      }
      if (up.error) {
        const raw = up.error.message || 'Could not upload document.';
        const msg = /row-level security|security policy/i.test(raw)
          ? `Could not store the file (permission). ${raw}`
          : raw;
        fail(msg, { path: dest, size, error: raw });
        return;
      }
      const storedPath = up.data?.path || dest;
      console.log('[upload]', { bucket: 'pet-documents', path: storedPath, size, error: null });
      const title = docForm.title.trim() || originalName;
      const kinds = (docForm.content_kinds.length ? docForm.content_kinds : ALL_CONTENT_KIND_KEYS).slice();
      const row: Record<string, unknown> = {
        pet_id: petId,
        kind: kindFromContent(kinds),
        file_path: storedPath,
        storage_path: storedPath,
        title,
        taken_on: docForm.taken_on || null,
        clinic: docForm.clinic.trim() || null,
        notes: docForm.notes.trim() || null,
        uploaded_by: user.id,
        ai_status: 'processing',
        content_kinds: kinds,
      };
      let { data: docData, error: insErr } = await supabase.from('pet_documents').insert(row).select().single();
      if (insErr && /content_kinds/i.test(insErr.message || '')) {
        delete row.content_kinds;
        const retry = await supabase.from('pet_documents').insert(row).select().single();
        docData = retry.data;
        insErr = retry.error;
      }
      if (insErr && /row-level security|security policy/i.test(insErr.message || '')) {
        console.warn('[upload] table insert RLS, trying insert_pet_document', insErr.message);
        const rpc = await supabase.rpc('insert_pet_document', {
          p_pet_id: petId,
          p_kind: row.kind,
          p_file_path: storedPath,
          p_title: title,
          p_taken_on: docForm.taken_on || null,
          p_clinic: docForm.clinic.trim() || null,
          p_notes: docForm.notes.trim() || null,
          p_content_kinds: kinds,
        });
        if (!rpc.error && rpc.data && typeof rpc.data === 'object' && (rpc.data as any).id) {
          docData = rpc.data as typeof docData;
          insErr = null;
        } else {
          console.warn('[upload] insert_pet_document rpc', rpc.error);
        }
      }
      if (insErr) {
        const raw = insErr.message || 'Uploaded, but could not save the record.';
        const msg = /row-level security|security policy/i.test(raw)
          ? `Could not save the record (permission). ${raw}`
          : raw;
        fail(msg, { path: storedPath, size, error: raw });
        return;
      }
      setDocModalVisible(false);
      load();
      if (docData?.id) {
        let dataUrl: string | null = null;
        let extractedText: string | undefined;
        let pageCount = 0;
        const mime = mimeGuess || contentType || blobTypeFromName(storedPath);
        if (isPdf || mime.includes('pdf') || /\.pdf$/i.test(storedPath)) {
          try {
            setParseProgress('Reading PDF pages…');
            const pdf = await extractPdfText(docFile.uri);
            extractedText = pdf.text;
            pageCount = pdf.pageCount;
            setParseProgress(`Reading ${pdf.pageCount} pages · ${pdf.charCount.toLocaleString()} characters`);
          } catch (e) {
            console.log('[pet-record] pdf text extract failed', e);
          }
        } else {
          dataUrl = await fileToDataUrl(docFile.uri).catch(() => null);
        }
        triggerExtraction(docData.id, {
          imageBase64: dataUrl,
          mimeType: mime,
          path: storedPath,
          extractedText,
          pageCount,
          kinds,
        });
      }
    } catch (e: any) {
      fail(e?.message || 'Could not upload document.', { path: dest || null, size, error: e?.message });
    } finally {
      setSavingDoc(false);
    }
  };


  const openConfirmFromParse = (documentId: string, parsed: any) => {
    console.log('[parse-pet-document] RAW', JSON.stringify(parsed));
    console.log('[parse-pet-document] vaccinations[0]', parsed.vaccinations?.[0]);
    const rawVax = [
      ...(parsed.vaccinations || []),
      ...((parsed.visits || []).flatMap((vis: any) =>
        (vis.vaccinations || vis.vaccines || []).map((x: any) => ({
          ...x,
          date: x.given || x.administered_on || vis.date,
          clinic: x.clinic || vis.clinic,
        }))
      )),
    ];
    const vax = rawVax.map((v: any) => {
      const dates = mapVaxRow(v);
      return {
        vaccine: v.name || v.vaccine || v.product || v.brand || '',
        brand: v.brand || v.product || null,
        dose: v.dose || null,
        administered_on: dates.given,
        next_due_on: dates.due,
        duration_years: null,
        manufacturer: v.manufacturer || v.maker || v.company || v.mfr || v.brand || null,
        lot_number: v.lot || v.lot_number || v.lotNumber || v.lot_no || v.serial || v.serial_number || null,
        lot_expires_on: parseAnyDate(v.lot_expires_on || v.lot_expiry || v.lot_expires),
        injection_site: v.injection_site || v.site || null,
        vaccine_type: v.vaccine_type || v.type || null,
        tag_number: v.tag_number || v.tag || null,
        vet_name: v.vet_name || v.vet || v.veterinarian || v.doctor || v.provider || v.clinician || null,
        vet_license: v.vet_license || v.license || v.vet_license_no || null,
        clinic_name: v.clinic || v.clinic_name || parsed.clinic || null,
        reactions: v.reactions || null,
      };
    });
    const labs = (parsed.labs || []).map((l: any) => {
      const printed = [l.value_text, l.result, l.value]
        .map((x) => (x == null ? '' : String(x).trim()))
        .find((s) => s && s.toLowerCase() !== 'unknown') || '';
      const numericOnly = /^-?\d+(\.\d+)?$/.test(printed);
      let flag = l.flag && String(l.flag).toLowerCase() !== 'unknown' ? l.flag : null;
      const low = printed.toLowerCase();
      if (low === 'detected') flag = 'abnormal';
      else if (low === 'not detected' || low === 'not-detected' || low === 'undetected') flag = 'normal';
      return {
        analyte: l.analyte || l.name || '',
        value_num: numericOnly ? parseFloat(printed) : (typeof l.value === 'number' ? l.value : null),
        value_text: printed || null,
        unit: l.unit && !printed.includes(String(l.unit)) ? l.unit : (numericOnly ? (l.unit || null) : null),
        ref_low: l.ref_low ?? null,
        ref_high: l.ref_high ?? null,
        flag,
      };
    });
    const visits = (parsed.visits || []).map((v: any) => ({
      event_type: 'visit',
      occurred_on: v.date || null,
      title: v.reason || v.clinic || 'Visit',
      notes: v.summary || null,
      cost_cents: null,
    }));
    const vaxDuplicates = new Set<number>();
    vax.forEach((v: any, i: number) => {
      if (!v.vaccine || !v.administered_on) return;
      if (vaccinations.some((e) => e.vaccine === v.vaccine && e.administered_on === v.administered_on)) vaxDuplicates.add(i);
    });
    let wt: ExtractedWeight = { value: null, unit: null, measured_on: null };
    if (parsed.weight && parsed.weight.value != null) {
      const raw = Number(parsed.weight.value);
      const unit = String(parsed.weight.unit || 'lb').toLowerCase();
      const measured = parsed.weight.measured_on || parsed.date || null;
      if (unit === 'kg') {
        wt = { value: Math.round(raw * 2.20462 * 10) / 10, unit: 'lb', measured_on: measured, originalValue: raw, originalUnit: 'kg' };
      } else {
        wt = { value: raw, unit: 'lb', measured_on: measured, originalValue: raw, originalUnit: unit };
      }
    }
    setEditableVax(vax);
    const allWeights: ExtractedWeight[] = Array.isArray(parsed.weights) && parsed.weights.length
      ? parsed.weights.map((w: any) => ({
          value: Number(w.value),
          unit: String(w.unit || 'lb').toLowerCase().startsWith('kg') ? 'kg' : 'lb',
          measured_on: w.measured_on || null,
        }))
      : (wt.value != null ? [wt] : []);
    setEditableWeights(allWeights);
    setEditableLabs(labs.length ? [{ panel_name: 'Labs', collected_on: parsed.date || null, clinic_name: parsed.clinic || null, vet_name: null, results: labs }] : []);
    setEditableWeight(wt);
    setEditableProcedures(visits);
    setConfirmEdit(new Set());
    setExtractionReview({
      documentId,
      data: { vaccinations: vax, lab_panels: [], weight: wt, procedures: visits, identity: parsed.identity || { microchip: null, date_of_birth: null, sex: null, breed: null, colors: null } },
      extractionId: documentId,
      vaxDuplicates,
      conditions: parsed.conditions || [],
      visitsCount: visits.length,
      labsCount: labs.length,
      weightsCount: allWeights.length,
      pageCount: parsed.page_count || parsed.progress?.page_count,
      exams: parsed.exams || [],
    });
  };

  const triggerExtraction = async (documentId: string, extra?: { imageBase64?: string | null; mimeType?: string; path?: string; extractedText?: string; pageCount?: number; kinds?: string[] }, silent = false) => {
    if (!user) return;
    parsedAttempted.current.add(documentId);
    if (!silent) { setExtracting(true); setParseProgress(extra?.pageCount ? `Reading ${extra.pageCount} pages · parsing visits` : 'Analyzing document…'); }
    await supabase.from('pet_documents').update({ ai_status: 'processing' }).eq('id', documentId);
    setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, ai_status: 'processing' } : d));
    try {
      let path = extra?.path;
      let kinds = extra?.kinds;
      if (!path || !kinds) {
        const { data: row } = await supabase.from('pet_documents').select('file_path, storage_path, content_kinds').eq('id', documentId).maybeSingle();
        path = path || row?.file_path || row?.storage_path;
        kinds = kinds || (Array.isArray(row?.content_kinds) ? row.content_kinds : undefined);
      }
      const payload: Record<string, unknown> = {
        document_id: documentId,
        path,
        mimeType: extra?.mimeType,
        kinds: kinds?.length ? kinds : ALL_CONTENT_KIND_KEYS,
      };
      let extractedText = extra?.extractedText;
      let pageCount = extra?.pageCount || 0;
      if (!extractedText && path && /\.pdf$/i.test(path) && typeof document !== 'undefined') {
        try {
          setParseProgress('Reading PDF pages…');
          const { data: signed } = await supabase.storage.from('pet-documents').createSignedUrl(path, 180);
          if (signed?.signedUrl) {
            const pdf = await extractPdfText(signed.signedUrl);
            extractedText = pdf.text;
            pageCount = pdf.pageCount;
            setParseProgress(`Reading ${pdf.pageCount} pages · parsing visits`);
          }
        } catch (e) {
          console.log('[parse-pet-document] client pdf extract failed', e);
        }
      }
      if (!silent && extra?.imageBase64 && !extractedText) payload.imageBase64 = extra.imageBase64;
      if (extractedText) {
        payload.extractedText = extractedText;
        payload.pageCount = pageCount;
      }
      console.log('[parse-pet-document] POST /api/parse-pet-document', { documentId, silent, hasImage: Boolean(payload.imageBase64), path });
      const resp = await fetch(siteApi('/api/parse-pet-document'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await resp.json().catch(() => ({ parsed: false, error: 'bad json', reason: 'model_error' }));
      console.log('[parse-pet-document] result.vaccinations', result.vaccinations);
      if (!resp.ok || !result.parsed) {
        const reason = result.reason || (result.error === 'too_large' ? 'too_large' : result.error === 'no_file' || result.labeled?.includes('missing') ? 'no_file' : 'model_error');
        const status = reason === 'no_file' ? 'missing_file' : 'failed';
        const summary = { reason, error: result.error, schemaVersion: 2 };
        await supabase.from('pet_documents').update({ ai_status: status, ai_summary: summary }).eq('id', documentId);
        setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, ai_status: status, ai_summary: summary } : d));
        return;
      }
      const title = result.title || null;
      await supabase.from('pet_documents').update({
        ai_status: 'ready',
        ai_summary: { ...result, schemaVersion: 2 },
        title: title || undefined,
        clinic: result.clinic || undefined,
        taken_on: result.date || undefined,
      }).eq('id', documentId);
      setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, ai_status: 'ready', ai_summary: result, title: title || d.title, clinic: result.clinic || d.clinic } : d));
      if (!silent) openConfirmFromParse(documentId, result);
    } catch (err: any) {
      console.error('[parse-pet-document] extraction error:', err);
      const summary = { reason: 'model_error', error: String(err), schemaVersion: 2 };
      await supabase.from('pet_documents').update({ ai_status: 'failed', ai_summary: summary }).eq('id', documentId);
      setDocuments((prev) => prev.map((d) => d.id === documentId ? { ...d, ai_status: 'failed', ai_summary: summary } : d));
    } finally {
      if (!silent) { setExtracting(false); setParseProgress(null); }
    }
  };

  const applyExtraction = async () => {
    if (!extractionReview || !petId || !user) return;
    setApplyingExtraction(true);
    const sourceDocId = extractionReview.documentId;
    let applied = { vaccinations: 0, weights: 0, labs: 0, visits: 0, exams: 0 };
    const errors: string[] = [];
    const run = async (label: string, fn: () => any) => {
      try {
        const res = await fn();
        if (res?.error) { errors.push(`${label}: ${res.error.message}`); return null; }
        return res;
      } catch (e: any) {
        errors.push(`${label}: ${e?.message || e}`);
        return null;
      }
    };

    try {
      const { data: rel } = await supabase.from('pet_relationships').select('id').eq('pet_id', petId).eq('user_id', user.id).is('ended_on', null).maybeSingle();
      if (!rel) {
        console.log('[apply] ensuring owner relationship');
        await supabase.from('pet_relationships').insert({
          pet_id: petId, user_id: user.id, relationship: 'owner', started_on: new Date().toISOString().slice(0, 10),
        });
      }

      // 1. vaccinations — doses only; reminders update next_due on that type
      const seenDose = new Set<string>();
      const existingVaxKeys = new Set(
        vaccinations.filter((e) => e.administered_on).map((e) => `${vaccineType(e.vaccine)}|${e.administered_on}`),
      );
      for (let i = 0; i < editableVax.length; i++) {
        if (extractionReview.vaxDuplicates.has(i)) continue;
        const v = editableVax[i];
        if (!v.vaccine) continue;
        const matched = matchCatalog(v.vaccine, vaxCatalog);
        const productName = matched.row?.name || v.vaccine;
        const type = vaccineType(productName);
        const years = durationYearsFromProduct(productName, matched.row);
        if (!v.administered_on && v.next_due_on) {
          const current = vaccinations
            .filter((e) => vaccineType(e.vaccine) === type && e.administered_on)
            .sort((a, b) => String(b.administered_on).localeCompare(String(a.administered_on)))[0];
          if (current) {
            console.log('[apply] reminder → next_due', type, v.next_due_on, 'on', current.id);
            const res = await supabase.from('pet_vaccinations').update({ next_due_on: v.next_due_on }).eq('id', current.id);
            if (res.error) errors.push(`Reminder ${type}: ${res.error.message}`);
          }
          continue;
        }
        if (!v.administered_on) continue;
        const key = `${type}|${v.administered_on}`;
        if (seenDose.has(key) || existingVaxKeys.has(key)) continue;
        seenDose.add(key);
        const nextDue = addYearsLocal(v.administered_on, years) || v.next_due_on || null;
        const payload = {
          pet_id: petId,
          vaccine: productName,
          vaccine_type: type,
          duration_years: years,
          administered_on: v.administered_on,
          next_due_on: nextDue,
          manufacturer: matched.row?.manufacturer || v.manufacturer || null,
          lot_number: v.lot_number || null,
          vet_name: v.vet_name || null,
          vet_clinic: v.clinic_name || null,
          recorded_by: user.id,
          author_id: user.id,
          source: 'ai_extracted',
          superseded: false,
        };
        console.log('[apply] vax payload', payload);
        const res = await supabase.from('pet_vaccinations').insert(payload).select('id').maybeSingle();
        console.log('[apply] vax result', res.error || res.data);
        if (res.error) { errors.push(`Vaccination "${productName}": ${res.error.message}`); continue; }
        applied.vaccinations++;
        existingVaxKeys.add(key);
        const older = vaccinations.filter((e) => vaccineType(e.vaccine) === type && String(e.administered_on || '') < String(v.administered_on));
        if (older.length) {
          await supabase.from('pet_vaccinations').update({ superseded: true }).in('id', older.map((e) => e.id));
        }
      }

      // 2. labs — write pet_id on every row (monitors query by pet_id, not panel_id)
      const rawDoc: any = documents.find((d) => d.id === sourceDocId)?.ai_summary || {};
      const labFlat: { analyte: string; value_text: string | null; value_num: number | null; unit: string | null; flag: string | null; collected_on: string | null; ref_low?: any; ref_high?: any }[] = [];
      const pushLab = (r: any, collected?: string | null) => {
        const analyte = r.analyte || r.name;
        if (!analyte) return;
        const printed = r.value_text != null ? String(r.value_text) : (r.value != null ? String(r.value) : (r.value_num != null ? String(r.value_num) : ''));
        const value_num = typeof r.value_num === 'number' ? r.value_num : (typeof r.value === 'number' ? r.value : parseFloat(printed));
        labFlat.push({
          analyte,
          value_text: printed || null,
          value_num: Number.isFinite(value_num) ? value_num : null,
          unit: r.unit || null,
          flag: r.flag && String(r.flag).toLowerCase() !== 'unknown' ? r.flag : null,
          collected_on: r.collected_on || r.date || collected || rawDoc.date || null,
          ref_low: r.ref_low,
          ref_high: r.ref_high,
        });
      };
      for (const panel of editableLabs) (panel.results || []).forEach((r) => pushLab(r, panel.collected_on));
      (rawDoc.labs || []).forEach((r: any) => pushLab(r, rawDoc.date));
      const seenLab = new Set<string>();
      for (const row of labFlat) {
        const key = `${row.analyte}|${row.collected_on}|${row.value_text}`;
        if (seenLab.has(key)) continue;
        seenLab.add(key);
        const full: any = {
          pet_id: petId,
          name: row.analyte,
          analyte: row.analyte,
          value: row.value_text,
          value_text: row.value_text,
          value_numeric: row.value_num,
          unit: row.unit,
          flag: row.flag,
          collected_on: row.collected_on,
          ref_low: row.ref_low ?? null,
          ref_high: row.ref_high ?? null,
          source: 'ai_extracted',
          author_id: user.id,
        };
        let res = await supabase.from('lab_results').insert(full).select('id').maybeSingle();
        if (res.error) {
          console.log('[apply] lab fail', row.analyte, res.error.message);
          const slim = { pet_id: petId, name: row.analyte, value: row.value_text, unit: row.unit, flag: row.flag, collected_on: row.collected_on };
          res = await supabase.from('lab_results').insert(slim).select('id').maybeSingle();
          if (res.error) { console.log('[apply] lab slim fail', row.analyte, res.error.message); errors.push(`Lab "${row.analyte}": ${res.error.message}`); continue; }
        }
        applied.labs++;
      }

      // 3. weights — every Weight History row
      const rawWeights: ExtractedWeight[] = editableWeights.length
        ? editableWeights
        : Array.isArray(rawDoc.weights) ? rawDoc.weights : (editableWeight.value != null ? [editableWeight] : []);
      const newest = rawWeights.filter((w) => w.value != null && w.measured_on).sort((a, b) => String(b.measured_on).localeCompare(String(a.measured_on)))[0];
      const seenWeight = new Set<string>();
      for (const w of rawWeights) {
        if (w.value == null) continue;
        const unit = String(w.unit || 'lb').toLowerCase();
        const lb = unit.startsWith('kg') ? Number(w.value) * 2.20462 : Number(w.value);
        const measured = w.measured_on || null;
        const key = `${measured}|${Math.round(lb * 10) / 10}`;
        if (seenWeight.has(key)) continue;
        seenWeight.add(key);
        const payload: any = { pet_id: petId, weight_lb: lb, measured_on: measured || new Date().toISOString().slice(0, 10), source: 'ai_extracted', author_id: user.id };
        console.log('[apply] weight payload', payload);
        let res = await supabase.from('weight_entries').insert(payload);
        if (res.error) {
          console.log('[apply] weight fail', res.error.message, payload);
          res = await supabase.from('weight_entries').insert({ pet_id: petId, weight_lb: lb });
          if (res.error) { errors.push(`Weight ${measured}: ${res.error.message}`); continue; }
        }
        applied.weights++;
      }
      if (newest && newest.value != null) {
        const unit = (newest.unit || 'lb').toLowerCase();
        const kg = unit === 'lb' ? lbToKg(newest.value) : newest.value;
        const currentMeasured = pet?.weight_measured_on || '';
        if (!currentMeasured || (newest.measured_on || '') > currentMeasured) {
          const ident: any = extractionReview.data?.identity || {};
          const petPatch: any = {
            weight_kg: kg,
            weight_measured_on: newest.measured_on,
          };
          if (ident.bcs) petPatch.body_condition_score = ident.bcs;
          if (ident.bcs >= 8 && !pet?.target_weight_kg) petPatch.target_weight_kg = lbToKg(15);
          // never overwrite an owner-entered DOB
          if (!pet?.date_of_birth && ident.date_of_birth) {
            petPatch.date_of_birth = parseAnyDate(ident.date_of_birth);
          }
          await run('Pet weight', () => supabase.from('pets').update(petPatch).eq('id', petId));
        }
      }

      // 4. visits
      for (const visit of editableProcedures) {
        if (!visit.title && !visit.event_type && !visit.occurred_on) continue;
        const visitPayload = {
          pet_id: petId,
          record_type: 'visit',
          title: visit.title || 'Visit',
          details: visit.notes || null,
          record_date: visit.occurred_on || new Date().toISOString().slice(0, 10),
          source: 'ai_extracted',
          author_id: user.id,
        };
        console.log('[apply] visit payload', visitPayload);
        const vRes = await supabase.from('medical_records').insert(visitPayload).select('id').maybeSingle();
        console.log('[apply] visit result', vRes.error || vRes.data);
        if (vRes.error) errors.push(`Visit "${visit.title || 'Visit'}": ${vRes.error.message}`);
        else applied.visits++;
        await run(`Visit event "${visit.title || 'Visit'}"`, () => supabase.from('pet_care_events').insert({
          pet_id: petId,
          event_type: 'visit',
          occurred_on: visit.occurred_on || null,
          title: visit.title || null,
          notes: visit.notes || null,
          recorded_by: user.id,
        }));
      }

      let examsIn = (extractionReview.exams && extractionReview.exams.length)
        ? extractionReview.exams
        : (rawDoc.exams || []);
      if (!examsIn.length) {
        const visitsSrc = rawDoc.visits || editableProcedures.map((v) => ({ date: v.occurred_on, clinic: null, summary: v.notes }));
        examsIn = visitsSrc.map((v: any) => ({
          visit_date: v.date || v.occurred_on,
          clinic: v.clinic || rawDoc.clinic || null,
          vitals: { bcs: rawDoc.identity?.bcs || pet?.body_condition_score || null },
          systems: [],
        })).filter((e: any) => e.visit_date);
      }
      const seenExam = new Set<string>();
      for (const ex of examsIn) {
        const visitDate = ex.visit_date || ex.date || null;
        const key = String(visitDate);
        if (visitDate && seenExam.has(key)) continue;
        if (visitDate) seenExam.add(key);
        const payload = {
          pet_id: petId,
          visit_date: visitDate,
          clinic: ex.clinic || null,
          vitals: ex.vitals || {},
          systems: ex.systems || [],
          source_document_id: sourceDocId,
          source: 'ai_extracted',
          author_id: user.id,
        };
        const { error, data } = await supabase.from('pet_exams').insert(payload).select('id').maybeSingle();
        if (error) {
          console.log('[apply] exam fail', visitDate, error.message);
          const slim = { pet_id: petId, visit_date: visitDate, clinic: ex.clinic || null, vitals: ex.vitals || {}, systems: ex.systems || [] };
          const retry = await supabase.from('pet_exams').insert(slim).select('id').maybeSingle();
          if (retry.error) errors.push(`Exam ${visitDate || ''}: ${retry.error.message}`);
          else applied.exams = (applied.exams || 0) + 1;
        } else {
          console.log('[apply] exam ok', visitDate, data?.id);
          applied.exams = (applied.exams || 0) + 1;
        }
        const v = ex.vitals || {};
        if (visitDate && (v.temp_f || v.hr || v.rr || v.bcs || v.weight_lb)) {
          await supabase.from('pet_vitals').insert({
            pet_id: petId, recorded_at: visitDate, temp_f: v.temp_f ?? null, hr: v.hr ?? null, rr: v.rr ?? null,
            weight_lb: v.weight_lb ?? null, bcs: v.bcs ?? null, source_document_id: sourceDocId,
          });
        }
      }

      for (const m of (rawDoc.medications || extractionReview.data && (extractionReview as any).medications || [])) {
        if (!m?.name) continue;
        const { error } = await supabase.from('medications_given').insert({
          pet_id: petId, name: m.name, dose: m.dose || null, route: m.route || null,
          administered_on: m.given_on || m.administered_on || null, status: m.status || 'completed',
          source_document_id: sourceDocId, source: 'ai_extracted', author_id: user.id,
        });
        if (error) console.log('[apply] med fail', m.name, error.message);
      }
      for (const d of (rawDoc.diagnostics || [])) {
        if (!d?.name) continue;
        const { error } = await supabase.from('pet_diagnostics').insert({
          pet_id: petId, kind: d.kind || 'other', name: d.name, result: d.result || null,
          taken_on: d.date || d.taken_on || null, source_document_id: sourceDocId,
        });
        if (error) console.log('[apply] diag fail', d.name, error.message);
      }
      for (const v of (rawDoc.vitals_series || [])) {
        const at = v.at || v.recorded_at;
        if (!at) continue;
        const { error } = await supabase.from('pet_vitals').insert({
          pet_id: petId, recorded_at: at, temp_f: v.temp_f ?? null, hr: v.hr ?? null, rr: v.rr ?? null,
          weight_lb: v.weight_lb ?? null, bcs: v.bcs ?? null, source_document_id: sourceDocId,
        });
        if (error) console.log('[apply] vital fail', at, error.message);
      }

      for (const c of extractionReview.conditions || []) {
        if (!c.name) continue;
        const status = (c.status || 'active').toLowerCase();
        const key = c.name.trim().toLowerCase();
        const existing = conditions.find((x) => (x.name || '').trim().toLowerCase() === key);
        if (existing) {
          await run(`Condition "${c.name}"`, () => supabase.from('pet_conditions').update({
            status,
            is_active: status === 'active',
            notes: c.notes || existing.notes,
            onset_date: c.onset_date || existing.onset_date || existing.diagnosed_on,
            resolved_date: status === 'resolved' ? (c.resolved_date || new Date().toISOString().slice(0, 10)) : existing.resolved_date,
            resolved_on: status === 'resolved' ? (c.resolved_date || new Date().toISOString().slice(0, 10)) : existing.resolved_on,
            source_document_id: sourceDocId,
            source: 'ai_extracted',
            author_id: user.id,
          }).eq('id', existing.id));
        } else {
          await run(`Condition "${c.name}"`, () => supabase.from('pet_conditions').insert({
            pet_id: petId,
            kind: c.kind || 'condition',
            name: c.name,
            notes: c.notes || null,
            is_active: status === 'active',
            status,
            onset_date: c.onset_date || null,
            diagnosed_on: c.onset_date || null,
            resolved_date: c.resolved_date || null,
            source_document_id: sourceDocId,
            source: 'ai_extracted',
            author_id: user.id,
          }));
        }
      }

      const identBcs = Number(rawDoc.identity?.bcs || extractionReview.data?.identity?.bcs);
      if (Number.isFinite(identBcs)) {
        await supabase.from('pets').update({
          body_condition_score: identBcs,
          ...(identBcs >= 8 && !pet?.target_weight_kg ? { target_weight_kg: lbToKg(15) } : {}),
        }).eq('id', petId);
      }

      await supabase.from('pet_documents').update({
        ai_status: 'confirmed',
        ai_summary: { ...(documents.find((d) => d.id === sourceDocId)?.ai_summary || {}), applied: true },
      }).eq('id', sourceDocId);
      await supabase.from('document_extractions').update({
        status: 'applied',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', extractionReview.extractionId);

      console.log('[apply] insert counts', applied, 'errors', errors);
      const [labsC, examsC, wC] = await Promise.all([
        supabase.from('lab_results').select('id', { count: 'exact', head: true }).eq('pet_id', petId),
        supabase.from('pet_exams').select('id', { count: 'exact', head: true }).eq('pet_id', petId),
        supabase.from('weight_entries').select('id', { count: 'exact', head: true }).eq('pet_id', petId),
      ]);
      const dbCounts = { labs: labsC.count ?? 0, exams: examsC.count ?? 0, weights: wC.count ?? 0 };
      console.log('[apply] SQL counts', dbCounts, labsC.error, examsC.error, wC.error);
      const summary = `Applied vax ${applied.vaccinations}, weights ${applied.weights}, labs ${applied.labs}, visits ${applied.visits} · DB labs=${dbCounts.labs} exams=${dbCounts.exams} weights=${dbCounts.weights}`;
      if (errors.length > 0) {
        showBanner(`${summary}. Some items had errors: ${errors.slice(0, 2).join('; ')}`, 'info');
      } else {
        showBanner(summary, 'success');
      }
      setExtractionReview(null);
      load();
    } catch (err) {
      console.error('[pet-record] apply extraction error:', err);
      showBanner('Could not apply the extracted data. Please try entering details manually.');
    }
    setApplyingExtraction(false);
  };

  const deleteDoc = (doc: PetDocument) => {
    setConfirmConfig({
      title: 'Delete document?',
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        await supabase.storage.from('pet-documents').remove([doc.file_path]);
        const { error } = await supabase.from('pet_documents').delete().eq('id', doc.id);
        if (error) { console.error('[pet-record] doc delete:', error); showBanner('Could not delete document.'); return; }
        load();
      },
    });
  };

  const openDocUrl = async (doc: PetDocument) => {
    const { data } = await supabase.storage.from('pet-documents').createSignedUrl(doc.file_path, 3600);
    if (data?.signedUrl) {
      if (Platform.OS === 'web') {
        window.open(data.signedUrl, '_blank');
      } else {
        Linking.openURL(data.signedUrl);
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.coral} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.75}>
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Pet not found.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()} activeOpacity={0.85}>
            <Text style={styles.retryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const breedDisplay = displayBreed(pet.breed_primary, pet.breed_secondary, pet.breed);
  const colorDisplay = [pet.primary_color, pet.secondary_color].filter(Boolean).join(' / ') || '—';
  const latestWeightRow = weightEntries.reduce((best, w) => {
    if (!w.measured_on) return best;
    if (!best || String(w.measured_on) > String(best.measured_on)) return w;
    return best;
  }, null as typeof weightEntries[0] | null);
  const latestLb = latestWeightRow?.weight_lb != null
    ? Math.round(Number(latestWeightRow.weight_lb) * 100) / 100
    : (pet.weight_kg != null ? kgToLb(pet.weight_kg) : null);
  const targetLb = pet.target_weight_kg != null ? kgToLb(pet.target_weight_kg) : (pet.body_condition_score != null && pet.body_condition_score >= 8 ? 15 : null);
  const weightDisplay = latestLb != null ? `${latestLb} lb` : '—';
  const currentRels = relationships.filter((r) => !r.ended_on);
  const pastRels = relationships.filter((r) => r.ended_on);
  const tableConditions = (() => {
    const map = new Map<string, PetCondition>();
    for (const c of conditions) {
      const key = (c.name || '').trim().toLowerCase();
      if (!key) continue;
      const status = (c.status || (c.is_active === false || c.resolved_on ? 'resolved' : 'active')).toLowerCase();
      if (!map.has(key)) map.set(key, { ...c, status });
    }
    return [...map.values()];
  })();
  const activeConditions = tableConditions.filter((c) => (c.status || 'active') === 'active');
  const resolvedConditions = tableConditions.filter((c) => (c.status || '') === 'resolved');
  const year = String(new Date().getFullYear());
  const visitsThisYear = medicalRecords.filter((m) => {
    const t = (m.record_type || 'visit').toLowerCase();
    if (t !== 'visit') return false;
    const d = m.record_date || '';
    return !d || d.startsWith(year);
  }).length;
  const healthVerdict = (aiFindings?.verdict === 'MONITOR' || aiFindings?.verdict === 'WATCH')
    ? 'MONITOR'
    : 'STABLE';
  const confirmedVax = vaccinations.filter((v) => v.confirmed !== false);
  const vaxGroups = (() => {
    const map = new Map<string, Vaccination[]>();
    for (const v of confirmedVax) {
      const t = vaccineType(v.vaccine);
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(v);
    }
    return [...map.entries()].map(([type, rows]) => {
      const sorted = rows.slice().sort((a, b) => String(b.administered_on || '').localeCompare(String(a.administered_on || '')));
      const current = sorted.find((r) => r.administered_on) || sorted[0];
      const history = sorted.filter((r) => r.id !== current?.id);
      return { type, current, history };
    });
  })();
  const vaxCount = vaxGroups.filter((g) => g.current?.administered_on).length;
  const currentVax = vaxGroups.map((g) => g.current).filter((v) => v?.administered_on) as Vaccination[];
  const pendingDocs = documents.filter((d) => {
    const st = d.ai_status;
    const ai = d.ai_summary && typeof d.ai_summary === 'object' ? d.ai_summary as any : {};
    if (st === 'confirmed' || ai.applied === true) return false;
    return st === 'ready' || st === 'parsed';
  });
  const pendingItemCount = (d: PetDocument) => {
    const ai = d.ai_summary && typeof d.ai_summary === 'object' ? d.ai_summary as any : {};
    return (ai.vaccinations?.length || 0) + (ai.labs?.length || 0) + (ai.visits?.length || 0) + (ai.conditions?.length || 0) + (ai.weight?.value ? 1 : 0);
  };
  const nowMs = Date.now();
  const vaxDues = currentVax.map((v) => v.next_due_on).filter(Boolean).map((d) => {
    const p = parseLocalParts(String(d));
    return p ? new Date(p.y, p.m - 1, p.d).getTime() : NaN;
  }).filter((t) => !Number.isNaN(t));
  const vaxTone: 'ok' | 'due' | 'over' | 'unknown' = vaxCount > 0
    ? (vaxDues.some((t) => t < nowMs) ? 'over' : vaxDues.some((t) => t - nowMs < 30 * 864e5) ? 'due' : 'ok')
    : pendingDocs.length > 0 ? 'due' : 'unknown';
  const thruIso = currentVax.map((v) => v.next_due_on).filter(Boolean).sort()[0];
  const thruLabel = thruIso ? formatDate(String(thruIso)) : null;
  const vaxSub = vaxTone === 'over' ? 'Overdue'
    : vaxCount === 0 ? (pendingDocs.length > 0 ? 'Review docs' : 'No record')
    : thruLabel ? `Valid thru ${thruLabel}`
    : vaxTone === 'due' ? 'Due soon' : 'Up to date';
  const felvFiv = labRows.filter((l) => /felv|fiv/i.test(String(l.analyte || l.name || '')));
  const bcs = pet.body_condition_score;
  let weightTone: 'ok' | 'due' | 'over' | 'unknown' = 'unknown';
  let weightSub = latestLb != null ? `${latestLb} lb` : 'No weight';
  if (latestLb != null && targetLb != null) {
    if (latestLb > targetLb * 1.08 || (bcs != null && bcs >= 7)) {
      weightTone = 'due';
      weightSub = `Overweight\n${latestLb} → ${targetLb} lb`;
    } else if (latestLb < targetLb * 0.92 || (bcs != null && bcs <= 3)) {
      weightTone = 'over';
      weightSub = `${latestLb} lb · underweight`;
    } else {
      weightTone = 'ok';
      weightSub = `${latestLb} lb · Ideal`;
    }
  } else if (bcs != null) {
    if (bcs >= 7) { weightTone = 'due'; weightSub = `Overweight · ${weightSub}`; }
    else if (bcs <= 3) { weightTone = 'over'; weightSub = `${weightSub} · Underweight`; }
    else { weightTone = 'ok'; weightSub = `${weightSub} · Ideal`; }
  }
  const felvNeg = felvFiv.length > 0 && felvFiv.every((l) => /not detected|negative|\bneg\b/i.test(String(l.value ?? l.value_text ?? '')));
  const felvPos = felvFiv.some((l) => /detected|\bpos/i.test(String(l.value ?? l.value_text ?? '')) && !/not detected/i.test(String(l.value ?? l.value_text ?? '')));
  const felvTone: 'ok' | 'due' | 'over' | 'unknown' = felvNeg ? 'ok' : felvPos ? 'over' : 'unknown';
  const felvSub = felvNeg ? 'Negative' : felvPos ? 'Detected' : 'No result';
  const lastDeviceSync = deviceReadings[0]?.recorded_at || petDevices[0]?.created_at;
  const stoolLog = deviceReadings.find((r) => /stool/i.test(String(r.metric || r.kind || '')));
  const scaleW = deviceReadings.find((r) => /weight|scale/i.test(String(r.metric || r.kind || '')));
  const weekAgo = Date.now() - 7 * 864e5;
  const visits7 = deviceReadings.filter((r) => /visit|use|activity/i.test(String(r.metric || r.kind || '')) && new Date(r.recorded_at).getTime() > weekAgo).length;
  const visitsPrev = deviceReadings.filter((r) => {
    const t = new Date(r.recorded_at).getTime();
    return /visit|use|activity/i.test(String(r.metric || r.kind || '')) && t <= weekAgo && t > weekAgo - 7 * 864e5;
  }).length;
  const activityTone: 'ok' | 'due' | 'over' | 'unknown' = petDevices.length === 0 && visits7 === 0 ? 'unknown'
    : (visits7 === 0 || (visitsPrev > 0 && visits7 < visitsPrev * 0.7)) ? 'due'
    : 'ok';
  const activitySub = activityTone === 'unknown' ? 'No device' : activityTone === 'due' ? 'Low activity' : `${visits7} visits / 7d`;
  const ownerNotes = documents.flatMap((d) => {
    const ai = d.ai_summary && typeof d.ai_summary === 'object' ? d.ai_summary : {};
    const notes = Array.isArray((ai as any).owner_notes) ? (ai as any).owner_notes : [];
    return notes.filter((n: any) => n && n.text).map((n: any) => ({ text: String(n.text), date: n.date || d.taken_on || null }));
  }).slice(0, 3);
  const ownerRel = currentRels.find((r) => /owner/i.test(r.relationship || '') && (!pet.owner_id || r.user_id === pet.owner_id))
    || currentRels.find((r) => /owner/i.test(r.relationship || ''));
  const ownerSince = ownerRel?.started_on || null;
  const priorOwners = relationships.filter((r) => /owner/i.test(r.relationship || '') && r.ended_on);
  const withYouLabel = (() => {
    if (!ownerSince) return '—';
    if (priorOwners.length === 0) return `First owner · since ${formatDate(ownerSince)}`;
    return `since ${formatDate(ownerSince)}`;
  })();
  const speciesLabel = (() => {
    const s = (pet.species || '').toLowerCase();
    if (s === 'cat') return 'Feline';
    if (s === 'dog') return 'Canine';
    return titleCase(pet.species) || '—';
  })();
  const sexSymbol = /female|spay/i.test(pet.gender || '') ? '♀' : /male|neuter/i.test(pet.gender || '') ? '♂' : '';
  const sexAlter = pet.spayed_neutered ? (/female|spay/i.test(pet.gender || '') || sexSymbol === '♀' ? 'Spayed' : 'Neutered') : '';
  const dobLine = pet.date_of_birth
    ? `${formatDate(pet.date_of_birth)} · ${ageFromDob(pet.date_of_birth, pet.age_text)}`
    : (pet.age_text || 'Add date of birth');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'medical', label: 'Medical' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'documents', label: 'Documents' },
    { key: 'clinics', label: 'Clinics' },
  ];
  const displayPhoto = isUsablePhoto(pet.main_photo_url)
    ? pet.main_photo_url
    : (photos.find((g) => isUsablePhoto(g.photo_url))?.photo_url || null);

  const lastExam = petExams[0] || null;
  const prevExam = petExams[1] || null;
  const confirmedDocs = documents.some((d) => d.ai_status === 'confirmed' || (d.ai_summary && (d.ai_summary as any).applied === true));
  const healthDataPoints = [
    weightEntries.length > 0 || pet.weight_kg != null,
    !!pet.date_of_birth,
    vaccinations.length > 0,
    labRows.length > 0,
    petExams.length > 0,
  ].filter(Boolean).length;
  const aiReady = confirmedDocs || healthDataPoints >= 3;
  const labSeries = (matchers: string[]) => {
    const rows = labRows.filter((r) => matchers.some((m) => new RegExp(m, 'i').test(String(r.analyte || r.name || ''))));
    const sorted = [...rows].sort((a, b) => String(a.collected_on || a.created_at || '').localeCompare(String(b.collected_on || b.created_at || '')));
    const nums = sorted.map((r) => parseFloat(r.value ?? r.value_num ?? r.value_text)).filter((n) => !Number.isNaN(n));
    const cur = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const curN = nums[nums.length - 1];
    const prevN = nums[nums.length - 2];
    return {
      label: cur?.analyte || cur?.name || matchers[0],
      value: cur ? String(cur.value ?? cur.value_text ?? cur.value_num ?? '—') : '—',
      unit: cur?.unit || '',
      delta: curN != null && prevN != null ? curN - prevN : null,
      flag: String(cur?.flag || '').toLowerCase(),
      nums,
    };
  };
  const sdma = labSeries(['sdma']);
  const creat = labSeries(['creatinine', 'creat']);
  const kidney = sdma.nums.length ? sdma : creat;
  const alt = labSeries(['\\balt\\b', 'alanine']);
  const hct = labSeries(['hct', 'hematocrit', '\\bpcv\\b']);
  const bcsVal = lastExam?.vitals?.bcs ?? pet.body_condition_score;
  const prevBcs = prevExam?.vitals?.bcs;
  const examWeight = lastExam?.vitals?.weight_lb;
  const prevWeight = prevExam?.vitals?.weight_lb ?? (weightEntries[1]?.weight_lb);
  const toggleMed = (k: string) => setOpenMed((s) => ({ ...s, [k]: !s[k] }));

  const runAiHealth = async () => {
    if (!pet || !petId) return;
    setAiBusy(true);
    try {
      const record = {
        species: pet.species,
        breed: pet.breed_primary || pet.breed,
        sex: pet.gender,
        dob: pet.date_of_birth,
        age: ageFromDob(pet.date_of_birth, pet.age_text),
        weight_lb: latestLb,
        target_weight_lb: targetLb,
        weight_entries: weightEntries.slice(0, 10).map((w) => ({ weight_lb: w.weight_lb, measured_on: w.measured_on })),
        document_ai_notes: documents.map((d) => {
          const ai = d.ai_summary && typeof d.ai_summary === 'object' ? d.ai_summary : {};
          return { title: d.title, date: d.taken_on, clinic: d.clinic, ai_note: (ai as any).ai_note || null };
        }),
        conditions: tableConditions.map((c) => ({
          name: c.name, kind: c.kind, status: c.status || (c.is_active === false ? 'resolved' : 'active'),
          onset_date: c.onset_date || c.diagnosed_on, resolved_date: c.resolved_date || c.resolved_on,
        })),
        vaccinations: vaccinations.map((v) => ({
          name: v.vaccine, brand: v.brand, date: v.administered_on, next_due: v.next_due_on, dose: v.dose,
        })),
        lab_results: labRows.map((l) => ({
          analyte: l.analyte || l.name, value: l.value ?? l.value_text ?? l.value_num, unit: l.unit, flag: l.flag, collected_on: l.collected_on || l.taken_on,
        })),
        lab_series: (() => {
          const g = new Map<string, any[]>();
          for (const row of labRows) {
            const name = (row.analyte || row.name || '').trim();
            if (!name) continue;
            const arr = g.get(name.toLowerCase()) || [];
            arr.push({ value: row.value ?? row.value_text ?? row.value_num, unit: row.unit, flag: row.flag, date: row.collected_on || row.taken_on || row.created_at });
            g.set(name.toLowerCase(), arr);
          }
          return [...g.entries()].map(([analyte, points]) => ({ analyte, points }));
        })(),
        visits: medicalRecords.map((m) => ({
          date: m.record_date, reason: m.title, summary: m.details, type: m.record_type,
        })),
        document_clinical_summaries: documents.map((d) => {
          const ai = d.ai_summary && typeof d.ai_summary === 'object' ? d.ai_summary : {};
          const visits = Array.isArray((ai as any).visits) ? (ai as any).visits : [];
          return {
            title: d.title,
            clinic: d.clinic,
            date: d.taken_on,
            summaries: visits.map((v: any) => v.summary).filter(Boolean),
            notes: d.notes,
          };
        }),
        exams: petExams.map((e) => ({ visit_date: e.visit_date, clinic: e.clinic, vitals: e.vitals, systems: e.systems })),
      };
      console.log('[pet-health-analysis] payload', { weight_lb: record.weight_lb, conditions: record.conditions.length, entries: record.weight_entries.length });
      const res = await fetch(siteApi('/api/pet-health-analysis'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record }),
      });
      const json = await res.json();
      console.log('[pet-health-analysis] response', json?.verdict, json?.findings?.length, json?.error);
      if (!res.ok || json?.ok === false) throw new Error(json?.error || 'AI Health failed.');
      setAiFindings(json);
      setAiLastRun(json.ran_at || new Date().toISOString());
      setAiShared(false);
      const nextNum = (aiRuns[0]?.run_number || aiRuns[0]?.run_no || aiRuns.length || 0) + 1;
      const prev = aiRuns[0];
      const diff = prev ? `Changed since last note · Run ${prev.run_number || prev.run_no}` : null;
      let ins = await supabase.from('ai_health_analyses').insert({
        pet_id: petId,
        run_number: nextNum,
        run_no: nextNum,
        findings: json.findings || [],
        timeline: json.timeline || [],
        trends: json.trends || [],
        conclusion: json.conclusion || json.summary,
        verdict: json.verdict,
        summary: json.summary,
        diff_vs_previous: diff,
        inputs: { verdict: json.verdict, timeline: json.timeline, trends: json.trends, conclusion: json.conclusion },
        model: 'claude-haiku-4-5',
      }).select('*').maybeSingle();
      if (ins.error) {
        console.log('[ai] insert fail', ins.error.message);
        ins = await supabase.from('ai_health_analyses').insert({
          pet_id: petId,
          findings: json.findings || [],
          summary: json.conclusion || json.summary,
        }).select('*').maybeSingle();
        if (ins.error) console.log('[ai] insert slim fail', ins.error.message);
      }
      const packed = { ...json, id: ins.data?.id, run_number: nextNum, ran_at: json.ran_at || new Date().toISOString(), diff_vs_previous: diff };
      setAiFindings(packed);
      setAiRuns((prevRuns) => [packed, ...prevRuns]);
    } catch (e: any) {
      showBanner(e.message || 'AI Health failed.');
    }
    setAiBusy(false);
  };

  const filteredBreeds = breeds.filter((b) => {
    if (pet.species === 'dog' || pet.species === 'Dog') return b.species === 'dog';
    if (pet.species === 'cat' || pet.species === 'Cat') return b.species === 'cat';
    return true;
  }).filter((b) => b.name.toLowerCase().includes(breedSearch.toLowerCase()));

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title={pet.name || 'Pet Record'} showBack />
      <Page>
        {banner && (
          <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />
        )}
        {/* Pet hero */}
        <View style={styles.heroWrap}>
          {displayPhoto ? (
            <SignedImage path={displayPhoto} style={styles.hero} />
          ) : (
            <View style={[styles.hero, styles.petPhotoFallback]}>
              <PawPrint color={Colors.textTertiary} size={48} />
            </View>
          )}
          {canEdit ? (
            <TouchableOpacity style={styles.changePhoto} onPress={uploadPhoto} disabled={photoUploading} activeOpacity={0.85}>
              {photoUploading ? <ActivityIndicator color="#fff" size="small" /> : <Pencil color="#fff" size={16} />}
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.petBannerInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.petName, { flex: 1 }]}>{pet.name || 'Unnamed'}{pet.previous_names?.length ? ` (formerly ${pet.previous_names.join(', ')})` : ''}</Text>
            {isPetOwner ? (
              <TouchableOpacity onPress={() => setShareOpen(true)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Share2 color={Colors.navy} size={16} />
              </TouchableOpacity>
            ) : null}
          </View>
          {breedDisplay !== '—' ? <Text style={styles.petMeta}>{breedDisplay}{pet.is_mixed ? ' (Mixed)' : ''}</Text> : null}
          {pet.age_text ? <Text style={styles.petMeta}>{pet.age_text}</Text> : null}
          {pet.gender ? <Text style={styles.petMeta}>{titleCase(pet.gender)}</Text> : null}
        </View>

        <VetExamCard
          exam={lastExam}
          exams={petExams}
          hints={[
            ...activeConditions.map((c) => `${c.name} ${c.severity || ''}`),
            ...medicalRecords.slice(0, 8).map((m) => `${m.title || ''} ${m.details || ''}`),
          ].join(' ')}
          onUpload={() => { setDocKindFilter(null); setTab('documents'); }}
        />

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.pillTab, active && styles.pillTabOn]}
                onPress={() => {
                  if (t.key === 'documents') setDocKindFilter(null);
                  setTab(t.key);
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.pillTabTxt, active && styles.pillTabTxtOn]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <View style={styles.tabContent}>
            <Card>
              <View style={styles.tileRow}>
                <StatusTile icon={Syringe} label="Vaccinated" sub={vaxSub} tone={vaxTone} onPress={() => {
                  if (pendingDocs[0]) { setDocKindFilter(null); setTab('documents'); openConfirmFromParse(pendingDocs[0].id, pendingDocs[0].ai_summary || {}); }
                  else { setTab('medical'); }
                }} />
                <StatusTile icon={Heart} label="Spayed/Neutered" sub={pet.spayed_neutered ? 'Yes' : 'Not recorded'} tone={pet.spayed_neutered ? 'ok' : 'unknown'} />
                <StatusTile icon={Shield} label="Microchipped" sub={chipNumber ? `••${String(chipNumber).slice(-4)}` : (pet.microchipped ? 'On file' : 'Not on file')} tone={(chipNumber || pet.microchipped) ? 'ok' : 'unknown'} />
              </View>
              <View style={styles.tileRow}>
                <StatusTile icon={Scale} label="Weight" sub={weightSub} tone={weightTone} extraLink={canCare ? 'Record' : undefined} extraOnPress={openWeight} />
                <StatusTile icon={FlaskConical} label="FELV/FIV" sub={felvTone === 'unknown' ? 'Add' : felvSub} tone={felvTone} onPress={() => { setTab('medical'); }} />
                <StatusTile icon={Activity} label="Activity" sub={activityTone === 'unknown' ? 'Connect' : activitySub} tone={activityTone} onPress={() => showBanner('Connect a litter box, feeder, or GPS collar from Me → Devices.', 'info')} />
              </View>
            </Card>
            {ownerNotes.length > 0 ? (
              <Card>
                <View style={styles.ovCardHead}>
                  <Text style={styles.ovKicker}>NOTES FOR YOU</Text>
                  <TouchableOpacity onPress={() => { setTab('medical'); }}>
                    <Text style={styles.linkTxt}>See all → History</Text>
                  </TouchableOpacity>
                </View>
                {ownerNotes.map((n, i) => (
                  <View key={i}>
                    <Text style={styles.docTitle}>{n.text}</Text>
                    {n.date ? <Text style={styles.docClinic}>{formatDate(String(n.date))}</Text> : null}
                  </View>
                ))}
              </Card>
            ) : null}

            <Card>
              <View style={styles.ovCardHead}>
                <Text style={styles.ovKicker}>CONNECTED DEVICES</Text>
                {petDevices.length > 0 ? (
                  <View style={[styles.ovChip, styles.ovChipTeal, { paddingVertical: 3 }]}>
                    <Text style={styles.ovChipTealTxt}>{petDevices.length} active</Text>
                  </View>
                ) : null}
              </View>
              {petDevices.map((d) => (
                <View key={d.id} style={styles.deviceRow}>
                  <View style={styles.greenDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docTitle}>{d.name || d.vendor || 'Device'}</Text>
                    <Text style={styles.docClinic}>Stool & urination monitoring · last sync {relativeAgo(lastDeviceSync)}</Text>
                  </View>
                </View>
              ))}
              {petDevices.length > 0 ? (
                <View style={styles.healthStats}>
                  <View style={styles.healthStat}>
                    <Text style={styles.ovStatN}>{stoolLog ? String(stoolLog.value ?? '—') : '—'}</Text>
                    <Text style={styles.healthL}>Last stool log</Text>
                  </View>
                  <View style={styles.healthStat}>
                    <Text style={styles.ovStatN}>{visits7 || '—'}</Text>
                    <Text style={styles.healthL}>Visits 7-day avg</Text>
                  </View>
                  <View style={styles.healthStat}>
                    <Text style={styles.ovStatN}>{scaleW ? `${scaleW.value} ${scaleW.unit || 'lb'}` : (latestLb != null ? `${latestLb} lb` : '—')}</Text>
                    <Text style={styles.healthL}>Scale weight</Text>
                  </View>
                </View>
              ) : null}
              <TouchableOpacity style={styles.dashedConnect} onPress={() => showBanner('Connect a litter box, feeder, or GPS collar from Me → Devices.', 'info')} activeOpacity={0.85}>
                <Bluetooth color={Colors.navy} size={16} />
                <Text style={styles.dashedConnectTxt}>+ Connect a device (litter box, feeder, GPS collar)</Text>
              </TouchableOpacity>
              <Text style={styles.ovFoot}>Device readings feed AI Health so patterns (weight, litter-box visits) show up in the analysis.</Text>
            </Card>

            <Card>
              <Text style={styles.ovKicker}>MICROCHIP</Text>
              <Text style={styles.chipMono}>{chipNumber || (pet.microchipped ? '•••• request access' : 'No microchip on file')}</Text>
              <Text style={styles.ovFoot}>Visible to the owner, verified org staff, and an active foster. Others must request access. Storing it here doesn’t register the chip — verify at the AAHA universal lookup after a move.</Text>
              {!chipNumber && !canEdit ? (
                <TouchableOpacity style={styles.requestBtn} onPress={async () => {
                  await supabase.from('identifier_access_requests').insert({ pet_id: petId, user_id: user?.id, status: 'pending' });
                  showBanner('Access requested.', 'success');
                }} activeOpacity={0.85}>
                  <Text style={styles.requestBtnTxt}>Request access</Text>
                </TouchableOpacity>
              ) : null}
            </Card>

            {activeConditions.length > 0 ? (
              <Card>
                <View style={styles.ovCardHead}>
                  <Text style={styles.ovKicker}>LATEST CONDITIONS</Text>
                  <TouchableOpacity onPress={() => { setTab('medical'); }}>
                    <Text style={styles.linkTxt}>See all → Medical</Text>
                  </TouchableOpacity>
                </View>
                {activeConditions.slice(0, 3).map((c) => (
                  <Text key={c.id} style={styles.docTitle}>{c.name}{c.severity ? ` · ${c.severity}` : ''}</Text>
                ))}
              </Card>
            ) : null}

            <Card identity>
              <View style={styles.ovCardHead}>
                <Text style={styles.ovKicker}>CHARACTERISTICS</Text>
                {canEdit ? (
                  <TouchableOpacity onPress={openDetailsSheet}>
                    <Text style={styles.linkTxt}>Edit</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <View style={styles.detailGrid}>
                <View style={styles.detailTile}>
                  <Text style={styles.detailK}>Species</Text>
                  <Text style={styles.detailV}>{speciesLabel}</Text>
                </View>
                <View style={styles.detailTile}>
                  <Text style={styles.detailK}>Breed</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.detailV}>{breedDisplay}</Text>
                    {pet.ai_traits ? (
                      <View style={[styles.ovChip, styles.ovChipTeal, { paddingVertical: 2, paddingHorizontal: 8 }]}>
                        <Text style={styles.ovChipTealTxt}>AI</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.detailTile}>
                  <Text style={styles.detailK}>Coat</Text>
                  <Text style={styles.detailV}>{titleCase(pet.coat || pet.ai_traits?.coat || inferCoat(pet.breed_primary || pet.breed, pet.breed_notes) || '') || '—'}</Text>
                </View>
                <View style={styles.detailTile}>
                  <Text style={styles.detailK}>Color</Text>
                  <ColorSwatches names={[pet.primary_color || '', pet.secondary_color || ''].filter(Boolean)} catalog={colors} />
                </View>
                <View style={styles.detailTile}>
                  <Text style={styles.detailK}>Sex</Text>
                  {sexSymbol ? (
                    <Text style={styles.detailV} numberOfLines={1}>
                      <Text style={[styles.sexGlyph, { color: sexSymbol === '♀' ? Colors.coral : Colors.navy }]}>{sexSymbol}</Text>
                      {sexAlter ? ` ${sexAlter}` : ''}
                    </Text>
                  ) : <Text style={styles.detailV}>—</Text>}
                </View>
                <View style={styles.detailTile}>
                  <Text style={styles.detailK}>Date of birth</Text>
                  {pet.date_of_birth ? (
                    <Text style={styles.detailV}>{dobLine}</Text>
                  ) : canEdit ? (
                    <TouchableOpacity onPress={openDetailsSheet}><Text style={{ fontFamily: Fonts.bold, fontSize: 13, color: Colors.coral }}>Add date of birth</Text></TouchableOpacity>
                  ) : (
                    <Text style={styles.detailV}>—</Text>
                  )}
                </View>
                <View style={styles.detailTile}>
                  <Text style={styles.detailK}>With you since</Text>
                  <Text style={styles.detailV}>{withYouLabel}</Text>
                </View>
                <View style={styles.detailTile}>
                  <Text style={styles.detailK}>Weight</Text>
                  <Text style={styles.detailV}>
                    {latestLb != null ? `${latestLb} lb` : '—'}{bcs != null ? ` · BCS ${bcs}` : ''}
                  </Text>
                </View>
              </View>
            </Card>

            <Card>
              <View style={styles.ovCardHead}>
                <Text style={styles.ovKicker}>PHOTOS</Text>
                {canEdit && photos.length < 10 && (
                  <TouchableOpacity style={styles.addBtn} onPress={uploadPhoto} disabled={photoUploading} activeOpacity={0.85}>
                    {photoUploading ? <ActivityIndicator size="small" color={Colors.coral} /> : <Plus color={Colors.coral} size={16} />}
                    <Text style={styles.addBtnText}>{photoUploading ? 'Uploading' : 'Add'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {photos.length === 0 ? (
                <Text style={styles.emptyText}>No photos yet.</Text>
              ) : (
                <View style={styles.photoGrid}>
                  {photos.map((photo, i) => (
                    <View key={photo.id} style={styles.photoCell}>
                      <TouchableOpacity onPress={() => canEdit && !photo.is_profile && setProfilePhoto(photo)} activeOpacity={0.85}>
                        <SignedImage path={photo.photo_url} style={styles.photoThumb} />
                      </TouchableOpacity>
                      {photo.is_profile && (
                        <View style={styles.profileBadge}>
                          <Text style={styles.profileBadgeText}>Profile</Text>
                        </View>
                      )}
                      {canEdit && (
                        <TouchableOpacity style={styles.photoDeleteBtn} onPress={() => deletePhoto(photo)} activeOpacity={0.75}>
                          <X color={Colors.white} size={12} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </Card>

            <Card>
              <Text style={styles.ovKicker}>{(pet.name || 'PET').toUpperCase()}’S STORY</Text>
              <Text style={styles.ovFoot}>Pull photos from Google or Apple Photos, then let AI draft a shareable story.</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                <TouchableOpacity style={styles.outlineChip} onPress={() => Linking.openURL('https://photos.google.com')} activeOpacity={0.85}>
                  <Text style={styles.outlineChipTxt}>Google Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineChip} onPress={() => Linking.openURL('https://www.icloud.com/photos')} activeOpacity={0.85}>
                  <Text style={styles.outlineChipTxt}>Apple Photos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.coralChip} onPress={() => router.push({ pathname: '/story-composer', params: { petId } })} activeOpacity={0.85}>
                  <Text style={styles.coralChipTxt}>Create story with AI</Text>
                </TouchableOpacity>
              </View>
            </Card>

            <View style={styles.subHeader}>
              <View style={styles.subHeaderLeft}>
                <Utensils color={Colors.navy} size={18} />
                <Text style={styles.subHeaderText}>Diet & Feeding</Text>
              </View>
              {canEdit && (
                <TouchableOpacity style={styles.addBtn} onPress={openEditDiet} activeOpacity={0.85}>
                  <Pencil color={Colors.coral} size={16} />
                  <Text style={styles.addBtnText}>{diet ? 'Edit' : 'Add'}</Text>
                </TouchableOpacity>
              )}
            </View>
            {diet ? (
              <Card>
                {diet.food_brand ? <DietRow label="Brand" value={diet.food_brand} /> : null}
                {diet.food_product ? <DietRow label="Product" value={diet.food_product} /> : null}
                {diet.food_type ? <DietRow label="Type" value={titleCase(diet.food_type)} /> : null}
                {diet.portion ? <DietRow label="Portion" value={diet.portion} /> : null}
                {diet.meals_per_day ? <DietRow label="Meals/day" value={String(diet.meals_per_day)} /> : null}
                {diet.treats ? <DietRow label="Treats" value={diet.treats} /> : null}
                {diet.avoid ? <DietRow label="Avoid" value={diet.avoid} /> : null}
                {diet.feeding_notes ? <DietRow label="Notes" value={diet.feeding_notes} /> : null}
              </Card>
            ) : (
              <Text style={styles.emptyText}>No diet information yet.</Text>
            )}
          </View>
        )}

        {tab === 'insurance' && (
          <View style={styles.tabContent}>
            <View style={[styles.infoCard, { backgroundColor: Colors.navy, borderColor: Colors.navy, padding: 16, paddingTop: 16 }]}>
              <Text style={[styles.healthKicker, { marginTop: 0 }]}>PET INSURANCE</Text>
              <Text style={{ fontFamily: Fonts.extrabold, fontSize: 17, color: Colors.white, marginTop: 8 }}>No policy on file</Text>
              <Text style={{ fontFamily: Fonts.regular, fontSize: 12, color: '#B9BCE0', marginTop: 4, lineHeight: 18 }}>
                Connect a carrier, upload a declarations PDF, or forward the policy email. Claims stay with the insurer — Rescue Army does not store card or login data.
              </Text>
              <TouchableOpacity style={{ backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 }} onPress={() => Linking.openURL('https://www.lemonade.com/pet')} activeOpacity={0.85}>
                <Text style={{ color: Colors.white, fontFamily: Fonts.bold }}>Connect Lemonade</Text>
              </TouchableOpacity>
              {canEdit ? (
                <TouchableOpacity style={{ borderWidth: 1.5, borderColor: Colors.white, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 10 }} onPress={() => { setDocKindFilter('insurance'); setTab('documents'); }} activeOpacity={0.85}>
                  <Text style={{ color: Colors.white, fontFamily: Fonts.bold }}>Open Documents</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={{ paddingVertical: 12, alignItems: 'center', marginTop: 4 }} onPress={() => Linking.openURL('mailto:support.animals@rescue-army.com?subject=' + encodeURIComponent('Forward insurance policy — ' + (pet.name || 'pet')))} activeOpacity={0.85}>
                <Text style={{ color: '#B9BCE0', fontFamily: Fonts.semibold }}>Forward email</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MEDICAL HUB */}
        {tab === 'medical' && (
          <View style={styles.tabContent}>
            <MedicalDashboard
              petName={pet.name || 'Pet'}
              verdict={healthVerdict}
              healthScore={typeof aiFindings?.health_score === 'number'
                ? aiFindings.health_score
                : Math.max(20, Math.min(100, (healthVerdict === 'STABLE' ? 88 : 64) - (aiFindings?.findings || []).filter((f: any) => /urgent/i.test(f.severity)).length * 10))}
              latestLb={latestLb}
              targetLb={targetLb}
              weightDelta={weightEntries[0] && weightEntries[1] ? weightEntries[0].weight_lb - weightEntries[1].weight_lb : null}
              weightPts={weightEntries.slice().reverse().map((w) => ({ v: w.weight_lb, at: w.measured_on, out: targetLb != null && w.weight_lb > targetLb * 1.08 }))}
              bcs={bcsVal}
              bcsDelta={bcsVal != null && prevBcs != null ? bcsVal - prevBcs : null}
              bcsPts={petExams.map((e) => ({ v: Number(e.vitals?.bcs), at: e.visit_date })).filter((p) => Number.isFinite(p.v)).reverse()}
              risks={(() => {
                const list: string[] = [];
                if (bcsVal != null && bcsVal >= 8) list.push(`Obesity · BCS ${bcsVal}`);
                for (const c of activeConditions) {
                  const n = (c.name || '').trim();
                  if (!n) continue;
                  if (list.some((x) => x.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(x.split('·')[0].trim().toLowerCase()))) continue;
                  list.push(n);
                }
                for (const f of (aiFindings?.findings || [])) {
                  const t = String(f.title || '').trim();
                  if (!t) continue;
                  if (list.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
                  list.push(t);
                }
                return list.slice(0, 3);
              })()}
              lastExam={lastExam}
              exams={petExams}
              vitals={[
                ...vitalRows,
                ...petExams.map((e) => ({ recorded_at: e.visit_date, ...(e.vitals || {}) })),
                ...weightEntries.map((w) => ({ recorded_at: w.measured_on, weight_lb: w.weight_lb })),
              ]}
              labRows={labRows}
              labCatalog={labCatalog}
              meds={medsGiven}
              diagnostics={diagnostics}
              aiFindings={aiFindings}
              aiRuns={aiRuns}
              aiBusy={aiBusy}
              aiShared={aiShared}
              aiReady={aiReady}
              onAddWeight={openWeight}
              onAddDob={openDetailsSheet}
              onUploadRecord={() => { setDocKindFilter(null); setTab('documents'); }}
              docCounts={{
                labs: documents.filter((d) => (d.content_kinds?.length ? d.content_kinds : ALL_CONTENT_KIND_KEYS).includes('labs')).length,
                vaccines: documents.filter((d) => (d.content_kinds?.length ? d.content_kinds : ALL_CONTENT_KIND_KEYS).includes('vaccinations')).length,
                records: documents.filter((d) => (d.content_kinds?.length ? d.content_kinds : ALL_CONTENT_KIND_KEYS).includes('exam_visit')).length,
              }}
              onOpenDocs={(kind) => { setDocKindFilter(kind); setTab('documents'); }}
              onRunAi={runAiHealth}
              onShareAi={async () => {
                if (aiFindings?.id) await supabase.from('ai_health_analyses').update({ shared_with_vet_at: new Date().toISOString() }).eq('id', aiFindings.id);
                setAiShared(true);
              }}
              onSelectRun={(r) => setAiFindings({ ...r, ran_at: r.created_at, conclusion: r.conclusion || r.summary })}
            />
            <TouchableOpacity onPress={() => toggleMed('records')} style={styles.ovCardHead}>
              <Text style={styles.ovKicker}>RECORDS</Text>
              <Text style={styles.linkTxt}>{openMed.records === false ? 'Show' : 'Hide'}</Text>
            </TouchableOpacity>
            {openMed.records !== false && (
            <View>

            {/* Conditions */}
            <View style={styles.subHeader}>
              <View style={styles.subHeaderLeft}>
                <Heart color={Colors.navy} size={18} />
                <Text style={styles.subHeaderText}>Conditions & Allergies</Text>
              </View>
              {canEdit && (
                <TouchableOpacity onPress={openAddCondition} activeOpacity={0.85}>
                  <Text style={styles.addLink}>Add manually</Text>
                </TouchableOpacity>
              )}
            </View>

            {conditions.length === 0 ? (
              <Text style={styles.emptyText}>No conditions, allergies, or medications recorded.</Text>
            ) : (
              <>
                {activeConditions.length > 0 && (
                  <>
                    {activeConditions.map((c) => (
                  <View key={c.id} style={styles.condCard}>
                    <View style={styles.condTopRow}>
                      <View style={[styles.condBadge, { backgroundColor: getCondBg(c.kind) }]}>
                        <Text style={[styles.condBadgeText, { color: getCondText(c.kind) }]}>{titleCase(c.kind)}</Text>
                      </View>
                      <SourceBadge source={c.source} />
                      {c.severity && c.severity !== 'none' && (
                        <View style={[styles.sevPill, { backgroundColor: getSevBg(c.severity) }]}>
                          <Text style={[styles.sevText, { color: getSevText(c.severity) }]}>{titleCase(c.severity)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.condName}>{c.name}</Text>
                    {c.diagnosed_on ? <Text style={styles.condDate}>Diagnosed: {formatDate(c.diagnosed_on)}</Text> : null}
                    {c.notes ? <Text style={styles.condNotes}>{c.notes}</Text> : null}
                    {canEdit && (
                      <View style={styles.condActions}>
                        <TouchableOpacity style={styles.condEditBtn} onPress={() => openEditCondition(c)} activeOpacity={0.85}>
                          <Text style={styles.condEditText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.condDeleteBtn} onPress={() => deleteCondition(c.id)} activeOpacity={0.85}>
                          <Trash2 color={Colors.critical} size={14} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                    ))}
                  </>
                )}
                {resolvedConditions.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Resolved</Text>
                    {resolvedConditions.map((c) => (
                      <View style={[styles.condCard, { opacity: 0.65 }]}>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <Text style={styles.condName}>{c.name}</Text>
                          <SourceBadge source={c.source} />
                        </View>
                        <Text style={styles.condDate}>Resolved: {formatDate(c.resolved_on)}</Text>
                        {canEdit && (
                          <View style={styles.condActions}>
                            <TouchableOpacity style={styles.condEditBtn} onPress={() => openEditCondition(c)} activeOpacity={0.85}>
                              <Text style={styles.condEditText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.condDeleteBtn} onPress={() => deleteCondition(c.id)} activeOpacity={0.85}>
                              <Trash2 color={Colors.critical} size={14} />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </>
                )}
              </>
            )}

            {/* Vaccinations */}
            <View style={styles.subHeader}>
              <View style={styles.subHeaderLeft}>
                <Syringe color={Colors.navy} size={18} />
                <Text style={styles.subHeaderText}>Vaccinations</Text>
              </View>
              {canEdit && (
                <TouchableOpacity onPress={openAddVax} activeOpacity={0.85}>
                  <Text style={styles.addLink}>Add manually</Text>
                </TouchableOpacity>
              )}
            </View>

            {vaccinations.length === 0 ? (
              <Text style={styles.emptyText}>No vaccinations recorded.</Text>
            ) : (
              vaxGroups.map(({ type, current, history }) => {
                if (!current) return null;
                const status = vaccinationStatus(current.next_due_on);
                const open = openVaxHist.has(type);
                return (
                  <View key={type} style={[
                    styles.vaxCard,
                    status === 'overdue' && styles.vaxCardOverdue,
                    status === 'due-soon' && styles.vaxCardDueSoon,
                  ]}>
                    <View style={styles.vaxTopRow}>
                      <Text style={styles.vaxName}>{type}</Text>
                      <SourceBadge source={current.source} />
                      {status === 'overdue' && (
                        <View style={[styles.vaxStatusPill, { backgroundColor: Colors.criticalBg }]}>
                          <CircleAlert color={Colors.critical} size={12} />
                          <Text style={[styles.vaxStatusText, { color: Colors.critical }]}>Overdue</Text>
                        </View>
                      )}
                      {status === 'due-soon' && (
                        <View style={[styles.vaxStatusPill, { backgroundColor: Colors.urgentBg }]}>
                          <Clock color={Colors.urgent} size={12} />
                          <Text style={[styles.vaxStatusText, { color: Colors.urgent }]}>Due soon</Text>
                        </View>
                      )}
                      {(status === 'ok' || status === 'none') && current.next_due_on && (
                        <View style={[styles.vaxStatusPill, { backgroundColor: Colors.tealBg }]}>
                          <Text style={[styles.vaxStatusText, { color: Colors.tealDark }]}>Valid thru {formatDate(current.next_due_on)}</Text>
                        </View>
                      )}
                    </View>
                    {current.administered_on ? <Text style={styles.vaxDetail}>Given: {formatDate(current.administered_on)}</Text> : <Text style={styles.vaxDetail}>No dose on file — due {formatDate(current.next_due_on)}</Text>}
                    {current.manufacturer ? <Text style={styles.vaxDetail}>Mfr: {current.manufacturer}</Text> : null}
                    {current.lot_number ? <Text style={styles.vaxDetail}>Lot: {current.lot_number}</Text> : null}
                    {canEdit && (
                      <View style={styles.vaxActions}>
                        <TouchableOpacity style={styles.vaxEditBtn} onPress={() => openEditVax(current)} activeOpacity={0.85}>
                          <Text style={styles.vaxEditText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.vaxDeleteBtn} onPress={() => deleteVax(current.id)} activeOpacity={0.85}>
                          <Trash2 color={Colors.critical} size={14} />
                        </TouchableOpacity>
                      </View>
                    )}
                    {history.length > 0 ? (
                      <TouchableOpacity onPress={() => setOpenVaxHist((s) => { const n = new Set(s); n.has(type) ? n.delete(type) : n.add(type); return n; })} style={{ marginTop: 8 }}>
                        <Text style={styles.linkTxt}>History ({history.length})</Text>
                      </TouchableOpacity>
                    ) : null}
                    {open ? history.map((h) => (
                      <View key={h.id} style={{ marginTop: 8, opacity: 0.7 }}>
                        <Text style={styles.vaxDetail}>{h.vaccine} · {formatDate(h.administered_on)}</Text>
                      </View>
                    )) : null}
                  </View>
                );
              })
            )}

            {/* Vet Summary Export */}
            <VetSummaryExport data={{
              pet: {
                name: pet.name,
                species: pet.species,
                breed: breedDisplay,
                gender: pet.gender,
                date_of_birth: pet.date_of_birth,
                microchipped: pet.microchipped,
                spayed_neutered: pet.spayed_neutered,
                weight_lb: latestLb,
                weight_kg: pet.weight_kg,
                body_condition_score: lastExam?.vitals?.bcs ?? pet.body_condition_score,
                target_weight_lb: targetLb,
                target_weight_kg: pet.target_weight_kg,
                previous_names: pet.previous_names,
                weight_unit: 'lb',
              },
              vaccinations: vaccinations.map((v) => ({
                vaccine: v.vaccine,
                administered_on: v.administered_on,
                next_due_on: v.next_due_on,
                lot_number: v.lot_number,
                manufacturer: v.manufacturer,
                vet_clinic: v.vet_clinic,
                vet_name: v.vet_name,
                superseded: v.superseded,
              })),
              conditions: conditions.map((c) => ({
                kind: c.kind,
                name: c.name,
                severity: c.severity,
                diagnosed_on: c.diagnosed_on,
                is_active: c.is_active,
              })),
              lastExam,
              meds: medsGiven,
              labs: labRows,
              clinics: [],
            }} />

            {/* Medical Records */}
            {medicalRecords.length > 0 ? (
            <>
            <View style={styles.subHeader}>
              <View style={styles.subHeaderLeft}>
                <Stethoscope color={Colors.navy} size={18} />
                <Text style={styles.subHeaderText}>Medical Records</Text>
              </View>
            </View>
            {medicalRecords.map((rec) => (
                <View key={rec.id} style={styles.medCard}>
                  <View style={styles.medTopRow}>
                    <View style={styles.medBadge}>
                      <Text style={styles.medBadgeText}>{titleCase(rec.record_type) || 'Record'}</Text>
                    </View>
                    <SourceBadge source={rec.source} />
                    <Text style={styles.medDate}>{formatDate(rec.record_date)}</Text>
                  </View>
                  {rec.title ? <Text style={styles.medTitle}>{rec.title}</Text> : null}
                </View>
            ))}
            </>
            ) : null}
          </View>
            )}
            {labRows.length > 0 ? (
            <>
            <TouchableOpacity onPress={() => toggleMed('labs')} style={styles.ovCardHead}>
              <Text style={styles.ovKicker}>LABS</Text>
              <Text style={styles.linkTxt}>{openMed.labs === false ? 'Show' : 'Hide'}</Text>
            </TouchableOpacity>
            {openMed.labs !== false && (
              <View>
                {(() => {
                  const groups = new Map<string, any[]>();
                  for (const row of labRows) {
                    const name = (row.analyte || row.name || '').trim();
                    if (!name) continue;
                    const arr = groups.get(name.toLowerCase()) || [];
                    arr.push(row);
                    groups.set(name.toLowerCase(), arr);
                  }
                  const items = [...groups.entries()].map(([key, rows]) => {
                    const sorted = [...rows].sort((a, b) => String(a.collected_on || a.created_at || '').localeCompare(String(b.collected_on || b.created_at || '')));
                    const cur = sorted[sorted.length - 1];
                    const prev = sorted[sorted.length - 2];
                    const curN = parseFloat(cur.value ?? cur.value_num ?? cur.value_text);
                    const prevN = prev ? parseFloat(prev.value ?? prev.value_num ?? prev.value_text) : NaN;
                    const delta = !isNaN(curN) && !isNaN(prevN) ? curN - prevN : null;
                    const flag = (cur.flag || '').toLowerCase();
                    return { key, label: cur.analyte || cur.name, cur, prev, delta, flag, nums: sorted.map((r) => parseFloat(r.value ?? r.value_num ?? r.value_text)).filter((n) => !isNaN(n)) };
                  });
                  if (items.length === 0) return null;
                  return (
                    <View style={{ gap: 8 }}>
                      {items.map((it) => (
                        <TouchableOpacity key={it.key} style={styles.labRow} onPress={() => setLabSpark(labSpark === it.key ? null : it.key)} activeOpacity={0.85}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.docTitle}>{it.label}</Text>
                            <Text style={styles.docClinic}>
                              {it.cur.value ?? it.cur.value_text ?? it.cur.value_num ?? '—'}{it.cur.unit ? ` ${it.cur.unit}` : ''}
                              {it.delta != null ? `  ${it.delta > 0 ? '▲' : it.delta < 0 ? '▼' : '•'} ${Math.abs(it.delta)}` : ''}
                            </Text>
                          </View>
                          <View style={[styles.docTypePill, it.flag === 'high' || it.flag === 'abnormal' ? { backgroundColor: Colors.criticalBg } : it.flag === 'low' ? { backgroundColor: Colors.standardBg } : { backgroundColor: Colors.tealBg }]}>
                            <Text style={styles.docTypePillTxt}>{it.flag || 'normal'}</Text>
                          </View>
                          {labSpark === it.key && it.nums.length > 1 ? <LabSparkline values={it.nums} color={it.flag === 'high' || it.flag === 'abnormal' ? Colors.critical : Colors.navy} /> : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })()}
              </View>
            )}
            </>
            ) : null}
            <TouchableOpacity onPress={() => toggleMed('visits')} style={styles.ovCardHead}>
              <Text style={styles.ovKicker}>VISITS</Text>
              <Text style={styles.linkTxt}>{openMed.visits === false ? 'Show' : 'Hide'}</Text>
            </TouchableOpacity>
            {openMed.visits !== false && (
            <View>
              {weightEntries.length > 0 ? (
                <View style={{ backgroundColor: Colors.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 }}>
                  <Text style={styles.subHeaderText}>Weight (lb)</Text>
                  <WeightLineChart points={weightEntries.slice().reverse()} targetLb={targetLb} height={180} />
                </View>
              ) : null}

            {!historyVisible ? (
              <View style={styles.historyLocked}>
                <Shield color={Colors.textTertiary} size={32} />
                <Text style={styles.historyLockedText}>
                  History events are sensitive. They are only visible to users with the appropriate access level.
                </Text>
                <TouchableOpacity style={styles.historyUnlockBtn} onPress={() => setHistoryVisible(true)} activeOpacity={0.85}>
                  <Text style={styles.historyUnlockText}>Show history</Text>
                </TouchableOpacity>
              </View>
            ) : historyEvents.length === 0 ? (
              <Text style={styles.emptyText}>No history events recorded.</Text>
            ) : (
              historyEvents.map((evt) => (
                <View key={evt.id} style={styles.timelineCard}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineType}>{titleCase(evt.event_type)}</Text>
                    <Text style={styles.timelineDate}>{formatDate(evt.occurred_on)}</Text>
                    {evt.public_summary ? <Text style={styles.timelineSummary}>{evt.public_summary}</Text> : null}
                    {evt.description ? <Text style={styles.timelineDesc}>{evt.description}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </View>
            )}
            {false && (
              <View style={{ gap: 12 }}>
                <View style={styles.aiDisclaimer}>
                  <Text style={styles.aiDisclaimerTxt}>AI is not a veterinarian. Findings are for your vet — no diagnosis or treatment from Rescue Army.</Text>
                </View>
                {aiRuns.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {aiRuns.map((r) => (
                      <TouchableOpacity key={r.id} style={[styles.ovChip, aiFindings?.id === r.id && styles.ovChipTeal]} onPress={() => {
                        setAiFindings({
                          id: r.id,
                          run_number: r.run_number,
                          verdict: r.verdict || r.inputs?.verdict,
                          findings: r.findings,
                          timeline: r.timeline || r.inputs?.timeline,
                          trends: r.trends || r.inputs?.trends,
                          conclusion: r.conclusion || r.inputs?.conclusion || r.summary,
                          ran_at: r.created_at || r.ran_at,
                        });
                        setAiShared(Boolean(r.shared_with_vet_at));
                      }}>
                        <Text style={aiFindings?.id === r.id ? styles.ovChipTealTxt : styles.ovChipTxt}>
                          Run {r.run_number || '?'} · {formatDate(r.created_at || r.ran_at)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : null}
                {weightEntries.length > 0 ? (
                  <Card>
                    <Text style={styles.ovKicker}>WEIGHT (LB)</Text>
                    <WeightLineChart points={weightEntries.slice().reverse()} targetLb={targetLb} height={140} />
                  </Card>
                ) : null}
                {(() => {
                  const flagged = new Map<string, number[]>();
                  for (const row of labRows) {
                    const flag = String(row.flag || '').toLowerCase();
                    if (flag !== 'high' && flag !== 'low' && flag !== 'abnormal') continue;
                    const name = String(row.analyte || row.name || '').trim();
                    if (!name) continue;
                    const n = parseFloat(row.value ?? row.value_num ?? row.value_text);
                    const arr = flagged.get(name) || [];
                    if (!isNaN(n)) arr.push(n);
                    flagged.set(name, arr);
                  }
                  for (const t of aiFindings?.trends || []) {
                    if (!t.analyte || /weight/i.test(t.analyte)) continue;
                    if (!flagged.has(t.analyte) && Array.isArray(t.points)) {
                      flagged.set(t.analyte, t.points.map((p: any) => parseFloat(p.value)).filter((n: number) => !isNaN(n)));
                    }
                  }
                  return [...flagged.entries()].map(([name, nums]) => nums.length > 1 ? (
                    <Card key={name}>
                      <Text style={styles.docTitle}>{name}</Text>
                      <LabSparkline values={nums} color={Colors.critical} />
                    </Card>
                  ) : null);
                })()}
                {(aiFindings?.timeline || []).map((t: any, i: number) => (
                  <View key={i} style={styles.timelineCard}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineType}>{t.title}</Text>
                      <Text style={styles.timelineDate}>{t.date ? formatDate(t.date) : ''}</Text>
                      {t.detail ? <Text style={styles.timelineSummary}>{t.detail}</Text> : null}
                    </View>
                  </View>
                ))}
                {(aiFindings?.findings || []).map((f: any, i: number) => {
                  const sev = String(f.severity || 'info').toLowerCase();
                  const dot = sev === 'urgent' ? Colors.critical : sev === 'watch' ? Colors.accent : Colors.teal;
                  return (
                    <View key={i} style={styles.aiFinding}>
                      <View style={[styles.aiDot, { backgroundColor: dot }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aiFindingTitle}>{f.title}</Text>
                        <Text style={styles.aiFindingBody}>{f.body || f.detail}</Text>
                      </View>
                    </View>
                  );
                })}
                {aiFindings?.conclusion ? (
                  <Card style={{ backgroundColor: Colors.navy, borderColor: Colors.navy }}>
                    <Text style={[styles.ovKicker, { color: '#B9BCE0' }]}>CONCLUSION</Text>
                    <Text style={{ fontFamily: Fonts.regular, fontSize: 13, color: Colors.white, lineHeight: 20, marginTop: 6 }}>{aiFindings.conclusion}</Text>
                  </Card>
                ) : null}
                <TouchableOpacity style={[styles.aiPrimaryBtn, (aiBusy || !aiReady) && styles.btnDisabled]} disabled={aiBusy || !aiReady} onPress={runAiHealth} activeOpacity={0.85}>
                  {aiBusy ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.aiPrimaryTxt}>{aiReady ? 'Run AI Health' : 'Add records first'}</Text>}
                </TouchableOpacity>
                <Text style={styles.aiLastRun}>
                  {aiFindings?.run_number ? `Run ${aiFindings.run_number} · ${formatDate(aiFindings.ran_at || aiLastRun)}` : (aiLastRun ? `Last run ${formatDate(aiLastRun)}` : 'Not run yet')}
                </Text>
                {aiFindings ? (
                  <TouchableOpacity
                    style={[styles.aiShareBtn, aiShared && { backgroundColor: Colors.teal }]}
                    onPress={async () => {
                      if (aiFindings.id) await supabase.from('ai_health_analyses').update({ shared_with_vet_at: new Date().toISOString() }).eq('id', aiFindings.id);
                      setAiShared(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.aiShareTxt}>{aiShared ? 'Shared with vet ✓' : 'Share analysis with my vet'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        )}

        {tab === 'documents' && (
            <View style={styles.tabContent}>
            {canEdit && pendingDocs.length > 0 ? (
              <TouchableOpacity style={styles.reviewBanner} onPress={() => {
                const d = pendingDocs[0];
                openConfirmFromParse(d.id, d.ai_summary || {});
              }} activeOpacity={0.85}>
                <Text style={styles.reviewBannerTxt}>Review all pending · {pendingDocs.length} document{pendingDocs.length === 1 ? '' : 's'}</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.subHeader}>
              <View style={styles.subHeaderLeft}>
                <FileText color={Colors.navy} size={18} />
                <Text style={styles.subHeaderText}>Documents</Text>
              </View>
              {canEdit && (
                <TouchableOpacity onPress={openAddDoc} activeOpacity={0.85}>
                  <Text style={styles.addLink}>Add manually</Text>
                </TouchableOpacity>
              )}
            </View>
            {docKindFilter ? (
              <TouchableOpacity style={styles.filterChip} onPress={() => setDocKindFilter(null)} activeOpacity={0.85}>
                <Text style={styles.filterChipTxt}>
                  {docKindFilter === 'labs' ? 'Labs' : docKindFilter === 'vaccinations' ? 'Vaccines' : docKindFilter === 'exam_visit' ? 'Records' : docKindFilter === 'insurance' ? 'Insurance' : docKindFilter}
                  {'  ·  Clear'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {(docKindFilter
              ? documents.filter((d) => (d.content_kinds?.length ? d.content_kinds : ALL_CONTENT_KIND_KEYS).includes(docKindFilter))
              : documents
            ).length === 0 ? (
              <Text style={styles.emptyText}>No documents uploaded. File is required — AI fills title, date, and clinic.</Text>
            ) : (
              documents.filter((d) => !docKindFilter || (d.content_kinds?.length ? d.content_kinds : ALL_CONTENT_KIND_KEYS).includes(docKindFilter)).map((doc) => {
                const ai = doc.ai_summary && typeof doc.ai_summary === 'object' ? doc.ai_summary : {};
                const title = doc.title || ai.title || ai.document_title || 'Untitled';
                const date = doc.taken_on || ai.date || ai.taken_on || null;
                const clinic = doc.clinic || ai.clinic || ai.clinic_name || null;
                const kinds = (doc.content_kinds && doc.content_kinds.length ? doc.content_kinds : ALL_CONTENT_KIND_KEYS);
                const status = doc.ai_status || (ai.error ? 'failed' : null);
                const reason = ai.reason || (status === 'missing_file' ? 'no_file' : null);
                const failLabel = reason === 'no_file' || status === 'missing_file'
                  ? 'File missing — re-upload'
                  : reason === 'too_large'
                    ? 'File too large — re-upload'
                    : reason === 'unsupported_type'
                      ? 'Unsupported file type'
                      : status === 'failed'
                        ? "AI couldn't read this"
                        : null;
                const unreviewed = (status === 'ready' || status === 'parsed') && ai.applied !== true;
                const confirmed = status === 'confirmed' || ai.applied === true;
                const nItems = pendingItemCount(doc);
                const statusLabel = status === 'processing'
                  ? 'Processing'
                  : unreviewed
                    ? `Review ${nItems || 0} item${nItems === 1 ? '' : 's'}`
                    : confirmed
                      ? 'Confirmed'
                      : (status === 'failed' || status === 'missing_file')
                        ? 'Failed'
                        : 'Uploaded';
                const statusTone = status === 'processing'
                  ? { bg: Colors.standardBg, fg: Colors.navy }
                  : unreviewed
                    ? { bg: Colors.urgentBg || '#FCF4DF', fg: Colors.urgent || '#E5A415' }
                    : confirmed
                      ? { bg: Colors.tealBg, fg: Colors.tealDark }
                      : (status === 'failed' || status === 'missing_file')
                        ? { bg: Colors.criticalBg, fg: Colors.critical }
                        : { bg: Colors.surface, fg: Colors.textSecondary };
                return (
                <View key={doc.id} style={styles.docCard}>
                  <TouchableOpacity style={styles.docMain} onPress={() => {
                    if (unreviewed && canEdit) openConfirmFromParse(doc.id, ai);
                    else openDocUrl(doc);
                  }} activeOpacity={0.85}>
                    <View style={styles.docIcon}>
                      {status === 'processing' ? <ActivityIndicator color={Colors.navy} size="small" /> : <FileText color={Colors.navy} size={18} />}
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={styles.docTitle}>{title}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {kinds.map((k) => {
                          const label = CONTENT_KINDS.find((c) => c.key === k)?.label || k;
                          return (
                            <View key={k} style={styles.docTypePill}>
                              <Text style={styles.docTypePillTxt}>{label}</Text>
                            </View>
                          );
                        })}
                        <View style={[styles.docTypePill, { backgroundColor: statusTone.bg }]}>
                          <Text style={[styles.docTypePillTxt, { color: statusTone.fg }]}>{statusLabel}</Text>
                        </View>
                      </View>
                      {failLabel ? <Text style={styles.docClinic}>{failLabel}</Text> : null}
                      {date ? <Text style={styles.docDate}>{formatDate(String(date))}</Text> : null}
                      {clinic ? <Text style={styles.docClinic}>{String(clinic)}</Text> : null}
                    </View>
                  </TouchableOpacity>
                  {canEdit && unreviewed ? (
                    <TouchableOpacity style={styles.docDeleteBtn} onPress={() => openConfirmFromParse(doc.id, ai)} activeOpacity={0.85}>
                      <Text style={{ fontFamily: Fonts.bold, fontSize: 11, color: Colors.coral }}>Review</Text>
                    </TouchableOpacity>
                  ) : null}
                  {canEdit && (status === 'failed' || status === 'missing_file') ? (
                    <>
                      <TouchableOpacity style={styles.docDeleteBtn} onPress={() => {
                        parsedAttempted.current.delete(doc.id);
                        void triggerExtraction(doc.id, { path: doc.file_path, kinds: doc.content_kinds || undefined }, false);
                      }} activeOpacity={0.85}>
                        <Text style={{ fontFamily: Fonts.bold, fontSize: 11, color: Colors.navy }}>Retry</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.docDeleteBtn} onPress={() => {
                        setTab('medical');
                        showBanner('Add vaccinations, labs, or visits with Add manually.', 'info');
                      }} activeOpacity={0.85}>
                        <Text style={{ fontFamily: Fonts.bold, fontSize: 11, color: Colors.navy }}>Add manually</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                  {canEdit ? (
                    <TouchableOpacity style={styles.docDeleteBtn} onPress={() => deleteDoc(doc)} activeOpacity={0.85}>
                      <Trash2 color={Colors.critical} size={14} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                );
              })
            )}
            </View>
        )}

        {tab === 'clinics' && (
          <View style={styles.tabContent}>
            <VetClinics
              petId={petId}
              userId={user!.id}
              canEdit={canEdit}
              onChanged={load}
              entries={(() => {
                const map = new Map<string, { name: string; phone: string | null; address: string | null; docCount: number; dates: string[] }>();
                const add = (name?: string | null, date?: string | null, extra?: { phone?: string | null; address?: string | null; isDoc?: boolean }) => {
                  const n = String(name || '').trim();
                  if (!n) return;
                  const key = n.toLowerCase().replace(/\s+/g, ' ');
                  const cur = map.get(key) || { name: n, phone: null as string | null, address: null as string | null, docCount: 0, dates: [] as string[] };
                  if (extra?.phone && !cur.phone) cur.phone = extra.phone;
                  if (extra?.address && !cur.address) cur.address = extra.address;
                  if (date) cur.dates.push(String(date));
                  if (extra?.isDoc) cur.docCount += 1;
                  map.set(key, cur);
                };
                for (const d of documents) {
                  const ai = d.ai_summary && typeof d.ai_summary === 'object' ? d.ai_summary : {};
                  add(d.clinic || ai.clinic || ai.clinic_name, d.taken_on || ai.date || ai.taken_on, { isDoc: true });
                  for (const v of ai.visits || []) add(v.clinic, v.date);
                  for (const e of ai.exams || []) add(e.clinic, e.visit_date || e.date);
                }
                for (const e of petExams) add(e.clinic, e.visit_date);
                for (const v of vaccinations) add(v.vet_clinic, v.administered_on);
                for (const r of medicalRecords) add((r as any).clinic || (r as any).clinic_name, r.record_date);
                for (const c of clinics) add(c.name, null, { phone: c.phone, address: c.address });
                return [...map.values()]
                  .map((c) => {
                    const dates = c.dates.filter(Boolean).sort();
                    return { name: c.name, phone: c.phone, address: c.address, lastVisit: dates[dates.length - 1] || null, docCount: c.docCount };
                  })
                  .sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || '') || a.name.localeCompare(b.name));
              })()}
            />
          </View>
        )}

      </Page>

      {/* === Vaccination Modal (full-featured) === */}
      <VetVaccinationModal
        petId={petId}
        userId={user!.id}
        editing={editingVax}
        clinics={clinics}
        visible={vaxModalVisible}
        onSaved={() => { setVaxModalVisible(false); load(); }}
        onClose={() => setVaxModalVisible(false)}
      />

      {/* === Condition Modal === */}
      <Modal visible={conditionModalVisible} animationType="slide" transparent onRequestClose={() => setConditionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingCondition ? 'Edit Entry' : 'Add Condition'}</Text>
                <TouchableOpacity onPress={() => setConditionModalVisible(false)}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Category *</Text>
              <View style={styles.pillRow}>
                {CONDITION_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.pill, conditionForm.kind === cat.key && styles.pillActive]}
                    onPress={() => setConditionForm((p) => ({ ...p, kind: cat.key }))}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pillText, conditionForm.kind === cat.key && styles.pillTextActive]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.modalLabel}>Name *</Text>
              <SearchablePicker
                items={conditionForm.kind === 'medication' ? medCatalog : condCatalog}
                placeholder="Search conditions…"
                onChange={(_id, item) => {
                  if (!item) return;
                  setConditionForm((p) => ({ ...p, name: item.name, kind: item.category === 'infectious' ? p.kind : p.kind }));
                }}
                onCustom={(label) => {
                  setConditionForm((p) => ({ ...p, name: label }));
                  void supabase.from('catalog_custom_pending').insert({ kind: 'condition', name: label, created_by: user?.id });
                }}
              />
              {conditionForm.name ? <Text style={styles.confirmLine}>{conditionForm.name}</Text> : null}
              <Text style={styles.modalLabel}>Severity</Text>
              <View style={styles.pillRow}>
                {SEVERITY_LEVELS.map((sev) => (
                  <TouchableOpacity
                    key={sev.key}
                    style={[styles.pill, conditionForm.severity === sev.key && { backgroundColor: sev.color }]}
                    onPress={() => setConditionForm((p) => ({ ...p, severity: sev.key }))}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pillText, conditionForm.severity === sev.key && styles.pillTextActive]}>{sev.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <DateField label="Diagnosed on" value={conditionForm.diagnosed_on} onChange={(v) => setConditionForm((p) => ({ ...p, diagnosed_on: v }))} />
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, conditionForm.is_active && styles.toggleBtnActive]}
                  onPress={() => setConditionForm((p) => ({ ...p, is_active: !p.is_active }))}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.toggleBtnText, conditionForm.is_active && styles.toggleBtnTextActive]}>
                    {conditionForm.is_active ? 'Active' : 'Resolved'}
                  </Text>
                </TouchableOpacity>
              </View>
              {!conditionForm.is_active && (
                <>
                  <DateField label="Resolved on" value={conditionForm.resolved_on} onChange={(v) => setConditionForm((p) => ({ ...p, resolved_on: v }))} />
                </>
              )}
              <Text style={styles.modalLabel}>Notes</Text>
              <TextInput style={[styles.modalInput, styles.modalInputMultiline]} value={conditionForm.notes} onChangeText={(v) => setConditionForm((p) => ({ ...p, notes: v }))} placeholder="Additional details" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} />
              <TouchableOpacity style={[styles.modalSubmitBtn, savingCondition && styles.btnDisabled]} onPress={saveCondition} disabled={savingCondition} activeOpacity={0.85}>
                {savingCondition ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSubmitText}>{editingCondition ? 'Save Changes' : 'Add Entry'}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* === Diet Modal === */}
      <Modal visible={dietModalVisible} animationType="slide" transparent onRequestClose={() => setDietModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Diet & Feeding</Text>
                <TouchableOpacity onPress={() => setDietModalVisible(false)}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Brand</Text>
              <TextInput style={styles.modalInput} value={dietForm.food_brand || ''} onChangeText={(v) => setDietForm((p) => ({ ...p, food_brand: v }))} placeholder="e.g. Purina, Royal Canin" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.modalLabel}>Product</Text>
              <TextInput style={styles.modalInput} value={dietForm.food_product || ''} onChangeText={(v) => setDietForm((p) => ({ ...p, food_product: v }))} placeholder="e.g. Pro Plan Adult" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.modalLabel}>Food Type</Text>
              <View style={styles.pillRow}>
                {FOOD_TYPES.map((ft) => (
                  <TouchableOpacity key={ft.key} style={[styles.pill, dietForm.food_type === ft.key && styles.pillActive]} onPress={() => setDietForm((p) => ({ ...p, food_type: ft.key }))} activeOpacity={0.85}>
                    <Text style={[styles.pillText, dietForm.food_type === ft.key && styles.pillTextActive]}>{ft.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.modalLabel}>Portion</Text>
              <TextInput style={styles.modalInput} value={dietForm.portion || ''} onChangeText={(v) => setDietForm((p) => ({ ...p, portion: v }))} placeholder="e.g. 1 cup, 200g" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.modalLabel}>Meals per day</Text>
              <TextInput style={styles.modalInput} value={String(dietForm.meals_per_day || '')} onChangeText={(v) => setDietForm((p) => ({ ...p, meals_per_day: parseInt(v) || 0 }))} placeholder="2" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
              <Text style={styles.modalLabel}>Treats</Text>
              <TextInput style={styles.modalInput} value={dietForm.treats || ''} onChangeText={(v) => setDietForm((p) => ({ ...p, treats: v }))} placeholder="e.g. 2 dental chews/day" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.modalLabel}>Foods to Avoid</Text>
              <TextInput style={[styles.modalInput, styles.modalInputMultiline]} value={dietForm.avoid || ''} onChangeText={(v) => setDietForm((p) => ({ ...p, avoid: v }))} placeholder="e.g. Chicken, grain, raw bones" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={2} />
              <Text style={styles.modalLabel}>Feeding Notes</Text>
              <TextInput style={[styles.modalInput, styles.modalInputMultiline]} value={dietForm.feeding_notes || ''} onChangeText={(v) => setDietForm((p) => ({ ...p, feeding_notes: v }))} placeholder="Any special instructions" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} />
              <TouchableOpacity style={[styles.modalSubmitBtn, savingDiet && styles.btnDisabled]} onPress={saveDiet} disabled={savingDiet} activeOpacity={0.85}>
                {savingDiet ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSubmitText}>Save Diet</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* === Weight Modal === */}
      <Modal visible={weightModalVisible} animationType="slide" transparent onRequestClose={() => setWeightModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Weight</Text>
              <TouchableOpacity onPress={() => setWeightModalVisible(false)}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.unitToggleRow}>
              <TouchableOpacity style={[styles.unitToggle, weightUnitLocal === 'lb' && styles.unitToggleActive]} onPress={() => setWeightUnitLocal('lb')} activeOpacity={0.85}>
                <Text style={[styles.unitToggleText, weightUnitLocal === 'lb' && styles.unitToggleTextActive]}>lb</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.unitToggle, weightUnitLocal === 'kg' && styles.unitToggleActive]} onPress={() => {
                if (weightInput) {
                  const num = parseFloat(weightInput);
                  if (!isNaN(num)) setWeightInput(weightUnitLocal === 'lb' ? String(Math.round(lbToKg(num) * 100) / 100) : String(kgToLb(num)));
                }
                setWeightUnitLocal('kg');
              }} activeOpacity={0.85}>
                <Text style={[styles.unitToggleText, weightUnitLocal === 'kg' && styles.unitToggleTextActive]}>kg</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>Weight ({weightUnitLocal})</Text>
            <TextInput style={styles.modalInput} value={weightInput} onChangeText={setWeightInput} placeholder="0" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
            <Text style={styles.modalLabel}>Body Condition Score (1–9)</Text>
            <View style={styles.bcsRow}>
              {[1,2,3,4,5,6,7,8,9].map((score) => (
                <TouchableOpacity key={score} style={[styles.bcsBtn, bcsInput === score && styles.bcsBtnActive]} onPress={() => setBcsInput(score)} activeOpacity={0.85}>
                  <Text style={[styles.bcsBtnText, bcsInput === score && styles.bcsBtnTextActive]}>{score}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {bcsInput != null ? <Text style={styles.bcsDesc}>{BCS_DESCRIPTIONS[bcsInput - 1]}</Text> : null}
            <Text style={styles.modalLabel}>Target Weight ({weightUnitLocal}, optional)</Text>
            <TextInput style={styles.modalInput} value={targetWeightInput} onChangeText={setTargetWeightInput} placeholder="Target weight" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
            <TouchableOpacity style={[styles.modalSubmitBtn, savingWeight && styles.btnDisabled]} onPress={saveWeight} disabled={savingWeight} activeOpacity={0.85}>
              {savingWeight ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSubmitText}>Save Weight</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* === Breed Modal === */}
      <Modal visible={breedModalVisible} animationType="slide" transparent onRequestClose={() => setBreedModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Breed Information</Text>
                <TouchableOpacity onPress={() => setBreedModalVisible(false)}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Primary Breed</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => { setSelectingBreedField('primary'); setBreedSearch(''); }} activeOpacity={0.85}>
                <Text style={breedForm.breed_primary ? styles.dropdownText : styles.dropdownPlaceholder}>{breedForm.breed_primary || 'Select breed'}</Text>
                <ChevronDown color={Colors.textTertiary} size={18} />
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Secondary Breed (optional)</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => { setSelectingBreedField('secondary'); setBreedSearch(''); }} activeOpacity={0.85}>
                <Text style={breedForm.breed_secondary ? styles.dropdownText : styles.dropdownPlaceholder}>{breedForm.breed_secondary || 'Select breed'}</Text>
                <ChevronDown color={Colors.textTertiary} size={18} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.toggleRowInline} onPress={() => setBreedForm((p) => ({ ...p, is_mixed: !p.is_mixed }))} activeOpacity={0.85}>
                <View style={[styles.checkbox, breedForm.is_mixed && styles.checkboxActive]}>
                  {breedForm.is_mixed && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.toggleInlineText}>Mixed breed</Text>
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Breed Notes</Text>
              <TextInput style={[styles.modalInput, styles.modalInputMultiline]} value={breedForm.breed_notes} onChangeText={(v) => setBreedForm((p) => ({ ...p, breed_notes: v }))} placeholder="e.g. DNA test confirms 25% Husky" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={2} />
              <TouchableOpacity style={[styles.modalSubmitBtn, savingBreed && styles.btnDisabled]} onPress={saveBreed} disabled={savingBreed} activeOpacity={0.85}>
                {savingBreed ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSubmitText}>Save Breed Info</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* === Breed Search Sub-Modal === */}
      <Modal visible={selectingBreedField !== null} animationType="fade" transparent onRequestClose={() => setSelectingBreedField(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.searchModalCard}>
            <View style={styles.searchHeader}>
              <TextInput style={styles.searchInput} value={breedSearch} onChangeText={setBreedSearch} placeholder="Search breeds..." placeholderTextColor={Colors.textTertiary} autoFocus />
              <TouchableOpacity onPress={() => setSelectingBreedField(null)}>
                <X color={Colors.textTertiary} size={22} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={filteredBreeds}
              keyExtractor={(item) => `${item.species}-${item.id}`}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchResultRow} onPress={() => {
                  if (selectingBreedField === 'primary') {
                    setBreedForm((p) => ({
                      ...p,
                      breed_primary: item.name,
                      breed_secondary: breedKey(item.name) === breedKey(p.breed_secondary) ? '' : p.breed_secondary,
                    }));
                  } else {
                    setBreedForm((p) => ({
                      ...p,
                      breed_secondary: breedKey(item.name) === breedKey(p.breed_primary) ? '' : item.name,
                    }));
                  }
                  setSelectingBreedField(null);
                }} activeOpacity={0.85}
                >
                  <Text style={styles.searchResultText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>

      {/* === Color Modal === */}
      <Modal visible={colorModalVisible} animationType="slide" transparent onRequestClose={() => setColorModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Color Information</Text>
                <TouchableOpacity onPress={() => setColorModalVisible(false)}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Primary Color</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setSelectingColorField('primary')} activeOpacity={0.85}>
                <Text style={colorForm.primary_color ? styles.dropdownText : styles.dropdownPlaceholder}>{colorForm.primary_color || 'Select color'}</Text>
                <ChevronDown color={Colors.textTertiary} size={18} />
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Secondary Color (optional)</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setSelectingColorField('secondary')} activeOpacity={0.85}>
                <Text style={colorForm.secondary_color ? styles.dropdownText : styles.dropdownPlaceholder}>{colorForm.secondary_color || 'Select color'}</Text>
                <ChevronDown color={Colors.textTertiary} size={18} />
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Color Notes / Markings</Text>
              <TextInput style={[styles.modalInput, styles.modalInputMultiline]} value={colorForm.color_notes} onChangeText={(v) => setColorForm((p) => ({ ...p, color_notes: v }))} placeholder="e.g. white blaze, one blue eye" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={2} />
              <TouchableOpacity style={[styles.modalSubmitBtn, savingColor && styles.btnDisabled]} onPress={saveColor} disabled={savingColor} activeOpacity={0.85}>
                {savingColor ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSubmitText}>Save Color Info</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={detailsSheetVisible} animationType="slide" transparent onRequestClose={() => setDetailsSheetVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={styles.modalCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.modalTitle}>Edit details</Text>
                <TouchableOpacity onPress={() => setDetailsSheetVisible(false)}><X color={Colors.textTertiary} size={22} /></TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Primary breed</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setSelectingBreedField('primary')} activeOpacity={0.85}>
                <Text style={breedForm.breed_primary ? styles.dropdownText : styles.dropdownPlaceholder}>{breedForm.breed_primary || 'Select breed'}</Text>
                <ChevronDown color={Colors.textTertiary} size={18} />
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Color</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setSelectingColorField('primary')} activeOpacity={0.85}>
                <Text style={colorForm.primary_color ? styles.dropdownText : styles.dropdownPlaceholder}>{colorForm.primary_color || 'Select color'}</Text>
                <ChevronDown color={Colors.textTertiary} size={18} />
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Secondary color</Text>
              <TouchableOpacity style={styles.dropdownBtn} onPress={() => setSelectingColorField('secondary')} activeOpacity={0.85}>
                <Text style={colorForm.secondary_color ? styles.dropdownText : styles.dropdownPlaceholder}>{colorForm.secondary_color || 'Optional'}</Text>
                <ChevronDown color={Colors.textTertiary} size={18} />
              </TouchableOpacity>
              <Text style={styles.modalLabel}>Date of birth</Text>
              {Platform.OS === 'web' ? (
                // @ts-ignore web date input
                <input type="date" value={detailsDob} onChange={(e: any) => setDetailsDob(e.target.value)} style={{ fontSize: 16, padding: 12, borderRadius: 10, border: `1px solid ${Colors.borderInput}`, fontFamily: Fonts.medium, color: Colors.navy, width: '100%' }} />
              ) : (
                <TextInput style={styles.modalInput} value={detailsDob} onChangeText={setDetailsDob} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
              )}
              <Text style={styles.modalLabel}>With you since</Text>
              {Platform.OS === 'web' ? (
                // @ts-ignore web date input
                <input type="date" value={detailsSince} onChange={(e: any) => setDetailsSince(e.target.value)} style={{ fontSize: 16, padding: 12, borderRadius: 10, border: `1px solid ${Colors.borderInput}`, fontFamily: Fonts.medium, color: Colors.navy, width: '100%' }} />
              ) : (
                <TextInput style={styles.modalInput} value={detailsSince} onChangeText={setDetailsSince} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
              )}
              <Text style={styles.modalLabel}>Sex</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['Female', 'Male'].map((s) => (
                  <TouchableOpacity key={s} style={[styles.editActionBtn, detailsSex.toLowerCase() === s.toLowerCase() && { backgroundColor: Colors.navy }]} onPress={() => setDetailsSex(s)}>
                    <Text style={[styles.editActionText, detailsSex.toLowerCase() === s.toLowerCase() && { color: Colors.white }]}>{s === 'Female' ? '♀ Female' : '♂ Male'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.editActionText, { marginTop: 14 }]}>Coat</Text>
              <View style={styles.pillRow}>
                {COAT_OPTIONS.map((c) => (
                  <TouchableOpacity key={c} style={[styles.pill, detailsCoat === c && styles.pillActive]} onPress={() => setDetailsCoat(c)}>
                    <Text style={[styles.pillText, detailsCoat === c && styles.pillTextActive]}>{titleCase(c)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }} onPress={() => setDetailsSpayed(!detailsSpayed)}>
                <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.navy, backgroundColor: detailsSpayed ? Colors.navy : Colors.white }} />
                <Text style={styles.editActionText}>Spayed / Neutered</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSubmitBtn, savingDetails && styles.btnDisabled]} onPress={saveDetails} disabled={savingDetails} activeOpacity={0.85}>
                {savingDetails ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.modalSubmitText}>Save details</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={selectingColorField !== null} animationType="fade" transparent onRequestClose={() => setSelectingColorField(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.searchModalCard}>
            <View style={styles.searchHeader}>
              <Text style={styles.searchTitle}>Select Color</Text>
              <TouchableOpacity onPress={() => setSelectingColorField(null)}>
                <X color={Colors.textTertiary} size={22} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={colors}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.searchResultRow} onPress={() => {
                  if (selectingColorField === 'primary') setColorForm((p) => ({ ...p, primary_color: item.name }));
                  else setColorForm((p) => ({ ...p, secondary_color: item.name }));
                  setSelectingColorField(null);
                }} activeOpacity={0.85}
                >
                  <Text style={styles.searchResultText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>

      {/* === Document Modal === */}
      <Modal visible={docModalVisible} animationType="slide" transparent onRequestClose={() => setDocModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Upload document</Text>
                <TouchableOpacity onPress={() => setDocModalVisible(false)}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>File *</Text>
              <TouchableOpacity style={styles.filePickBtn} onPress={pickDocFile} disabled={savingDoc} activeOpacity={0.85}>
                <FileText color={Colors.navy} size={18} />
                <Text style={styles.filePickText}>{docFile ? ((docFile as any).name || 'File selected') : 'Choose file...'}</Text>
              </TouchableOpacity>
              <Text style={styles.modalLabel}>What’s in this file</Text>
              <View style={styles.pillRow}>
                {CONTENT_KINDS.map((ck) => {
                  const on = docForm.content_kinds.includes(ck.key);
                  return (
                    <TouchableOpacity
                      key={ck.key}
                      style={[styles.pill, on && styles.pillActive]}
                      onPress={() => setDocForm((p) => {
                        const has = p.content_kinds.includes(ck.key);
                        const next = has ? p.content_kinds.filter((k) => k !== ck.key) : [...p.content_kinds, ck.key];
                        return { ...p, content_kinds: next.length ? next : [ck.key] };
                      })}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.pillText, on && styles.pillTextActive]}>{ck.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.modalLabel}>Title</Text>
              <TextInput style={styles.modalInput} value={docForm.title} onChangeText={(v) => setDocForm((p) => ({ ...p, title: v }))} placeholder="Defaults to filename" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.modalLabel}>Date (optional — AI will fill)</Text>
              <TextInput style={styles.modalInput} value={docForm.taken_on} onChangeText={(v) => setDocForm((p) => ({ ...p, taken_on: v }))} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.modalLabel}>Clinic (optional — AI will fill)</Text>
              <TextInput style={styles.modalInput} value={docForm.clinic} onChangeText={(v) => setDocForm((p) => ({ ...p, clinic: v }))} placeholder="Clinic name" placeholderTextColor={Colors.textTertiary} />
              {docError ? (
                <InlineBanner message={docError} kind="error" onDismiss={() => setDocError(null)} />
              ) : null}
              <TouchableOpacity
                style={[styles.modalSubmitBtn, (savingDoc || !docFile) && styles.btnDisabled]}
                onPress={saveDoc}
                disabled={savingDoc || !docFile}
                activeOpacity={0.85}
              >
                {savingDoc ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSubmitText}>Upload</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <ConfirmDialog config={confirmConfig} onClose={() => setConfirmConfig(null)} />

      {/* === Extraction Review Modal === */}
      {extractionReview && (
        <Modal visible animationType="slide" onRequestClose={() => setExtractionReview(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
            <View style={{ flex: 1, width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' }}>
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
                <Text style={styles.modalTitle}>Review extraction</Text>
                <Text style={styles.extractionSummary}>
                  {editableVax.length} vaccine{editableVax.length !== 1 ? 's' : ''} · {extractionReview.visitsCount} visit{extractionReview.visitsCount !== 1 ? 's' : ''} · {extractionReview.labsCount} lab{extractionReview.labsCount !== 1 ? 's' : ''} · {editableWeights.length} weight{editableWeights.length !== 1 ? 's' : ''}
                  {extractionReview.pageCount ? ` · ${extractionReview.pageCount} pages` : ''}
                </Text>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }} showsVerticalScrollIndicator={false}>
                {editableWeights.length > 0 ? (
                  <View style={styles.confirmCard}>
                    <Text style={styles.docTitle}>Weight history ({editableWeights.length})</Text>
                    {editableWeights.slice().sort((a, b) => String(b.measured_on).localeCompare(String(a.measured_on))).map((w, i) => (
                      <Text key={`${w.measured_on}-${i}`} style={styles.confirmLine}>{w.measured_on} · {w.value} {w.unit || 'lb'}</Text>
                    ))}
                  </View>
                ) : null}
                {editableVax.map((vax, i) => {
                  const editing = confirmEdit.has(`vax-${i}`);
                  const matched = matchCatalog(vax.vaccine, vaxCatalog);
                  return (
                    <View key={`vax-${i}`} style={[styles.confirmCard, extractionReview.vaxDuplicates.has(i) && styles.extractionItemDuplicate]}>
                      <View style={styles.ovCardHead}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <ConfidenceDot level={matched.confidence} />
                          <Text style={styles.docTitle}>{matched.row?.name || vax.vaccine || 'Vaccine'}{!vax.administered_on && vax.next_due_on ? ' · reminder' : ''}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setConfirmEdit((s) => { const n = new Set(s); n.has(`vax-${i}`) ? n.delete(`vax-${i}`) : n.add(`vax-${i}`); return n; })}>
                          <Text style={styles.linkTxt}>{editing ? 'Done' : 'Edit'}</Text>
                        </TouchableOpacity>
                      </View>
                      {matched.custom ? <Text style={styles.duplicateBadgeText}>Not in list — add as custom</Text> : null}
                      {extractionReview.vaxDuplicates.has(i) ? <Text style={styles.duplicateBadgeText}>Already recorded</Text> : null}
                      {editing ? (
                        <>
                          <SearchablePicker
                            items={vaxCatalog}
                            value={matched.row?.id || null}
                            placeholder="Search vaccines…"
                            onChange={(_id, item) => {
                              if (!item) return;
                              setEditableVax((prev) => prev.map((v, idx) => idx === i ? {
                                ...v,
                                vaccine: item.name,
                                manufacturer: item.manufacturer || v.manufacturer,
                                duration_years: item.duration_years != null ? Number(item.duration_years) : v.duration_years,
                              } : v));
                            }}
                            onCustom={(label) => {
                              setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, vaccine: label } : v));
                              void supabase.from('catalog_custom_pending').insert({ kind: 'vaccine', name: label, created_by: user?.id });
                            }}
                          />
                          <View style={styles.extractionRow}>
                            <DateField label="Given" value={vax.administered_on} onChange={(val) => setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, administered_on: val } : v))} />
                            <DateField label="Next due" value={vax.next_due_on} onChange={(val) => setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, next_due_on: val } : v))} />
                          </View>
                        </>
                      ) : (
                        <>
                          {vax.administered_on ? <Text style={styles.confirmLine}><Text style={styles.confirmK}>Given  </Text>{vax.administered_on}</Text> : <DateField label="Given" value={vax.administered_on} onChange={(val) => setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, administered_on: val } : v))} />}
                          {vax.next_due_on ? <Text style={styles.confirmLine}><Text style={styles.confirmK}>Next due  </Text>{vax.next_due_on}</Text> : null}
                          {vax.manufacturer ? <Text style={styles.confirmLine}><Text style={styles.confirmK}>Manufacturer  </Text>{vax.manufacturer}</Text> : null}
                          {vax.lot_number ? <Text style={styles.confirmLine}><Text style={styles.confirmK}>Lot  </Text>{vax.lot_number}</Text> : null}
                        </>
                      )}
                    </View>
                  );
                })}
                {editableLabs.flatMap((panel, pi) => (panel.results || []).map((result, ri) => {
                  const key = `lab-${pi}-${ri}`;
                  const editing = confirmEdit.has(key);
                  const matched = matchCatalog(result.analyte, labCatalog);
                  const unit = result.unit || matched.row?.unit || '';
                  const shown = [result.value_text, result.value_num != null ? String(result.value_num) : '', unit].filter(Boolean).join(' ');
                  return (
                    <View key={key} style={styles.confirmCard}>
                      <View style={styles.ovCardHead}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                          <ConfidenceDot level={matched.confidence} />
                          <Text style={styles.docTitle}>{matched.row?.name || result.analyte || 'Lab'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setConfirmEdit((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; })}>
                          <Text style={styles.linkTxt}>{editing ? 'Done' : 'Edit'}</Text>
                        </TouchableOpacity>
                      </View>
                      {matched.custom ? <Text style={styles.duplicateBadgeText}>Not in list — add as custom</Text> : null}
                      {editing ? (
                        <View style={styles.extractionRow}>
                          <TextInput style={styles.extractionInputSmall} value={result.value_text || ''} onChangeText={(val) => setEditableLabs((prev) => prev.map((p, idx) => idx === pi ? { ...p, results: p.results.map((r, ridx) => ridx === ri ? { ...r, value_text: val } : r) } : p))} placeholder="Value" placeholderTextColor={Colors.textTertiary} />
                          <TextInput style={styles.extractionInputSmall} value={result.unit || ''} onChangeText={(val) => setEditableLabs((prev) => prev.map((p, idx) => idx === pi ? { ...p, results: p.results.map((r, ridx) => ridx === ri ? { ...r, unit: val } : r) } : p))} placeholder="Unit" placeholderTextColor={Colors.textTertiary} />
                        </View>
                      ) : (
                        <>
                          {shown ? <Text style={styles.confirmLine}><Text style={styles.confirmK}>Result  </Text>{shown}</Text> : null}
                          {result.flag ? <Text style={styles.confirmLine}><Text style={styles.confirmK}>Flag  </Text>{result.flag}</Text> : null}
                          {panel.collected_on ? <Text style={styles.confirmLine}><Text style={styles.confirmK}>Collected  </Text>{panel.collected_on}</Text> : null}
                        </>
                      )}
                    </View>
                  );
                }))}
                {editableWeight.value != null ? (
                  <View style={styles.confirmCard}>
                    <Text style={styles.docTitle}>Weight</Text>
                    <Text style={styles.confirmLine}>
                      {editableWeight.originalUnit === 'kg'
                        ? `${editableWeight.value} lb (from ${editableWeight.originalValue} kg)`
                        : `${editableWeight.value} lb`}
                      {editableWeight.measured_on ? ` · ${editableWeight.measured_on}` : ''}
                    </Text>
                  </View>
                ) : null}
                {editableProcedures.map((proc, i) => {
                  const key = `visit-${i}`;
                  const editing = confirmEdit.has(key);
                  return (
                    <View key={key} style={styles.confirmCard}>
                      <Text style={styles.ovKicker}>VISIT {proc.occurred_on || ''}</Text>
                      <View style={styles.ovCardHead}>
                        <Text style={styles.docTitle}>{proc.title || 'Visit'}</Text>
                        <TouchableOpacity onPress={() => setConfirmEdit((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; })}>
                          <Text style={styles.linkTxt}>{editing ? 'Done' : 'Edit'}</Text>
                        </TouchableOpacity>
                      </View>
                      {editing ? (
                        <>
                          <TextInput style={styles.extractionInput} value={proc.title || ''} onChangeText={(val) => setEditableProcedures((prev) => prev.map((p, idx) => idx === i ? { ...p, title: val } : p))} placeholder="Reason" placeholderTextColor={Colors.textTertiary} />
                          <TextInput style={styles.extractionInput} value={proc.occurred_on || ''} onChangeText={(val) => setEditableProcedures((prev) => prev.map((p, idx) => idx === i ? { ...p, occurred_on: val } : p))} placeholder="Date" placeholderTextColor={Colors.textTertiary} />
                          <TextInput style={[styles.extractionInput, styles.modalInputMultiline]} value={proc.notes || ''} onChangeText={(val) => setEditableProcedures((prev) => prev.map((p, idx) => idx === i ? { ...p, notes: val } : p))} placeholder="Clinical summary" placeholderTextColor={Colors.textTertiary} multiline />
                        </>
                      ) : (
                        <>
                          {proc.occurred_on ? <Text style={styles.confirmLine}><Text style={styles.confirmK}>Date  </Text>{proc.occurred_on}</Text> : null}
                          {proc.notes ? <Text style={styles.confirmLine}><Text style={styles.confirmK}>Clinical summary  </Text>{proc.notes}</Text> : null}
                        </>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              <View style={styles.confirmFooter}>
                <TouchableOpacity style={[styles.coralConfirm, applyingExtraction && styles.btnDisabled]} onPress={applyExtraction} disabled={applyingExtraction} activeOpacity={0.85}>
                  {applyingExtraction ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.coralConfirmTxt}>Confirm all</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setExtractionReview(null)} style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={styles.modalCloseText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      )}

      {/* Extracting indicator */}
      {extracting && (
        <Modal visible={true} animationType="fade" transparent>
          <View style={styles.extractingOverlay}>
            <View style={styles.extractingCard}>
              <ActivityIndicator size="large" color={Colors.coral} />
              <Text style={styles.extractingText}>{parseProgress || 'Analyzing document with AI...'}</Text>
            </View>
          </View>
        </Modal>
      )}
      {shareOpen && petId ? (
        <SharePetSheet visible petId={petId} petName={pet.name || 'this pet'} onClose={() => setShareOpen(false)} />
      ) : null}
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function DietRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.dietRow}>
      <Text style={styles.dietRowLabel}>{label}</Text>
      <Text style={styles.dietRowValue}>{value || '—'}</Text>
    </View>
  );
}

function getCondBg(kind: string): string {
  if (kind === 'allergy') return Colors.urgentBg;
  if (kind === 'medication') return Colors.tealBg;
  if (kind === 'dietary_restriction') return Colors.standardBg;
  if (kind === 'behavioral') return Colors.surface;
  return Colors.coralBg;
}

function getCondText(kind: string): string {
  if (kind === 'allergy') return Colors.urgent;
  if (kind === 'medication') return Colors.tealDark;
  if (kind === 'dietary_restriction') return Colors.accentDark;
  if (kind === 'behavioral') return Colors.text;
  return Colors.coralDark;
}

function getSevBg(sev: string): string {
  if (sev === 'severe') return Colors.criticalBg;
  if (sev === 'moderate') return Colors.urgentBg;
  return Colors.tealBg;
}

function getSevText(sev: string): string {
  if (sev === 'severe') return Colors.critical;
  if (sev === 'moderate') return Colors.urgent;
  return Colors.tealDark;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  col: { width: '100%', maxWidth: 720, alignSelf: 'center', flex: 1 },
  heroWrap: { width: '100%', aspectRatio: 4/3, borderRadius: 20, overflow: 'hidden', backgroundColor: Colors.surface, marginTop: 12 },
  hero: { width: '100%', height: '100%' },
  changePhoto: { position: 'absolute', right: 12, bottom: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(38,38,94,0.85)', alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerBack: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text },

  petBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: Colors.white },
  petPhoto: { width: 64, height: 64, borderRadius: 32 },
  petPhotoFallback: { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  petBannerInfo: { width: '100%', marginTop: 12 },
  petName: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text },
  petMeta: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  tabBar: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, paddingHorizontal: 0, marginTop: 12, marginBottom: 0, position: 'relative' },
  hubRow: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  pillTab: { backgroundColor: Colors.white, borderWidth: 1, borderColor: '#E8EAF0', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, flexShrink: 0 },
  pillTabOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillTabTxt: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.text },
  pillTabTxtOn: { color: Colors.white },
  aiBox: { backgroundColor: Colors.criticalBg, borderRadius: 14, padding: 14, gap: 8 },
  aiDisclaimer: { backgroundColor: Colors.criticalBg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  aiDisclaimerTxt: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.critical, lineHeight: 16 },
  aiFinding: { flexDirection: 'row', gap: 10, backgroundColor: Colors.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  aiDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  aiFindingTitle: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy },
  aiFindingBody: { fontFamily: Fonts.regular, fontSize: 12.5, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  aiPrimaryBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  aiPrimaryTxt: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.white },
  aiLastRun: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textTertiary, textAlign: 'center' },
  aiShareBtn: { backgroundColor: Colors.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  aiShareTxt: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.white },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ovChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  ovChipTeal: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  ovChipTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.navy },
  ovChipTealTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.white },
  ovCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  ovKicker: { fontFamily: Fonts.extrabold, fontSize: 11, letterSpacing: 0.8, color: Colors.textTertiary, textTransform: 'uppercase' },
  tabContent: { paddingTop: 12, paddingHorizontal: 0, gap: 14 },
  statusCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  tileRow: { flexDirection: 'row', gap: 10, width: '100%' },
  statusTileWrap: { flex: 1 },
  statusTile: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, minHeight: 96, height: '100%' },
  statusIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statusLabel: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.navy, textAlign: 'center' },
  statusSub: { fontFamily: Fonts.bold, fontSize: 11, textAlign: 'center', lineHeight: 14 },
  statusExtra: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.tealDark },
  outlineChip: { borderWidth: 1.5, borderColor: Colors.borderInput, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  outlineChipTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.navy },
  coralChip: { backgroundColor: Colors.coral, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  coralChipTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.white },
  reviewBanner: { backgroundColor: Colors.standardBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F3E2B0' },
  reviewBannerTxt: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.accentDark, textAlign: 'center' },
  ovCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ovFoot: { fontFamily: Fonts.regular, fontSize: 11.5, color: Colors.textSecondary, lineHeight: 17 },
  ovStatN: { fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.navy },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.teal },
  dashedConnect: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderInput, borderRadius: 12, padding: 12 },
  dashedConnectTxt: { fontFamily: Fonts.semibold, fontSize: 12, color: Colors.navy, flex: 1 },
  chipMono: { fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.navy, letterSpacing: 1 },
  requestBtn: { backgroundColor: Colors.navy, borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginTop: 4 },
  requestBtnTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 13 },
  linkTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.tealDark },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailTile: { width: '48%', minHeight: 64, gap: 4, backgroundColor: Colors.surface, borderRadius: 12, padding: 10, justifyContent: 'center' },
  detailK: { fontFamily: Fonts.bold, fontSize: 10.5, letterSpacing: 0.7, color: '#9AA1AC', textTransform: 'uppercase' },
  detailV: { fontFamily: Fonts.medium, fontSize: 14, color: Colors.navy, fontWeight: '600' },
  sexGlyph: { fontFamily: Fonts.extrabold, fontSize: 20, lineHeight: 22, fontWeight: '700' },
  aiTitle: { fontFamily: Fonts.extrabold, color: Colors.critical, fontSize: FontSizes.md },
  reviewBox: { backgroundColor: Colors.standardBg, borderRadius: 14, padding: 14, gap: 8 },
  reviewTitle: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.accentDark },

  healthHero: { backgroundColor: Colors.navy, borderRadius: 18, padding: 16, gap: 14, marginBottom: 8 },
  healthKicker: { fontFamily: Fonts.extrabold, fontSize: 11, color: '#B9BCE0', letterSpacing: 0.8 },
  healthStable: { fontFamily: Fonts.extrabold, fontSize: 11, color: Colors.teal, backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  healthStats: { flexDirection: 'row', gap: 8 },
  healthStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center' },
  healthN: { fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.white },
  healthL: { fontFamily: Fonts.semibold, fontSize: 10, color: '#D3EFEC', marginTop: 2, textTransform: 'uppercase', textAlign: 'center' },
  weightBarTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, width: '100%', marginTop: 8, overflow: 'hidden' },
  weightBarFill: { height: 6, backgroundColor: Colors.teal, borderRadius: 3 },
  docTypePill: { backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  docTypePillTxt: { fontFamily: Fonts.bold, fontSize: 10, color: Colors.navy },

  infoCard: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  infoLabel: { flex: 1, fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text, marginLeft: 10 },
  infoValue: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary },

  editActionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  editActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.surface },
  editActionText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },

  sectionLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 16 },

  relCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  relBadge: { alignSelf: 'flex-start', backgroundColor: Colors.tealBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  relBadgeText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.tealDark },
  relName: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  relDate: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 16 },
  subHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subHeaderText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.surface },
  addBtnText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.coral },
  addLink: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.coral, paddingVertical: 8, paddingHorizontal: 4 },
  filterChip: { alignSelf: 'flex-start', backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 4 },
  filterChipTxt: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.navy },

  vaxCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  vaxCardOverdue: { borderColor: Colors.critical, borderWidth: 1.5 },
  vaxCardDueSoon: { borderColor: Colors.urgent, borderWidth: 1.5 },
  vaxTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  vaxName: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text, flex: 1 },
  vaxStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  vaxStatusText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold },
  vaxDetail: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  vaxNotes: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textBody, marginTop: 4, lineHeight: 20 },
  boosterTag: { fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.navy, backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  bcsRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  bcsBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
  bcsBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  bcsBtnText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.textSecondary },
  bcsBtnTextActive: { color: Colors.white },
  bcsDesc: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 6, lineHeight: 16 },
  vaxActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  vaxEditBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surface },
  vaxEditText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
  vaxDeleteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.critical },

  medCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  medTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  medBadge: { backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  medBadgeText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.text },
  medDate: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  medTitle: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text, marginTop: 4 },

  historyLocked: { alignItems: 'center', padding: 32, backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border },
  historyLockedText: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: 12, marginBottom: 20 },
  historyUnlockBtn: { backgroundColor: Colors.surface, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 },
  historyUnlockText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.navy },

  timelineCard: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.coral, marginTop: 4 },
  timelineContent: { flex: 1, backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  timelineType: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text, textTransform: 'capitalize' },
  timelineDate: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  timelineSummary: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.text, marginTop: 6 },
  timelineDesc: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 4, lineHeight: 20 },

  personCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  personAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.coral, justifyContent: 'center', alignItems: 'center' },
  personInitial: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.white },
  personInfo: { flex: 1 },
  personName: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  personRole: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  personCardPast: { opacity: 0.7 },
  personAvatarPast: { backgroundColor: Colors.surface },
  personInitialPast: { color: Colors.textTertiary },
  personNamePast: {},

  emptyText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
  errorText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  retryBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  btnDisabled: { opacity: 0.6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '85%' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text },
  modalCloseText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.coral },
  modalLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy, marginBottom: 6, marginTop: 12 },
  modalInput: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.surface },
  modalInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  modalSubmitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  modalSubmitText: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.white },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  pillTextActive: { color: Colors.white },

  toggleRow: { marginTop: 12 },
  toggleBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignSelf: 'flex-start' },
  toggleBtnActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  toggleBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  toggleBtnTextActive: { color: Colors.white },

  toggleRowInline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  toggleInlineText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.borderInput, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  checkmark: { color: Colors.white, fontSize: 14, fontFamily: Fonts.bold },

  unitToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  unitToggle: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  unitToggleActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  unitToggleText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.textSecondary },
  unitToggleTextActive: { color: Colors.white },

  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: Colors.surface },
  dropdownText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text },
  dropdownPlaceholder: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textTertiary },

  searchModalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text },
  searchTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, flex: 1 },
  searchResultRow: { paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchResultText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text },

  filePickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: Colors.surface },
  filePickText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoCell: { position: 'relative' },
  photoThumb: { width: 100, height: 100, borderRadius: 14 },
  profileBadge: { position: 'absolute', top: 4, left: 4, backgroundColor: Colors.coral, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  profileBadgeText: { fontSize: 9, fontFamily: Fonts.bold, color: Colors.white },
  photoDeleteBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  photoHint: { fontSize: 9, fontFamily: Fonts.regular, color: Colors.textTertiary, textAlign: 'center', marginTop: 2 },

  dietCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  dietRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dietRowLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textTertiary, width: 100 },
  dietRowValue: { flex: 1, fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.text },

  condCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  condTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  condBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  condBadgeText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold },
  sevPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  sevText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold },
  condName: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text },
  condDate: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  condNotes: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textBody, marginTop: 4, lineHeight: 20 },
  condActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  condEditBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surface },
  condEditText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
  condDeleteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.critical },

  docCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  docMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  docIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  docInfo: { flex: 1 },
  docTitle: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  docDate: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  docClinic: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 1 },
  labRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  docNotes: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textBody, marginTop: 2 },
  docDeleteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.critical },

  extractionSummary: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: 16, lineHeight: 22 },
  extractionSection: { marginBottom: 16 },
  extractionSectionTitle: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.navy, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  extractionItem: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  extractionItemDuplicate: { borderColor: Colors.urgent, borderWidth: 1.5, opacity: 0.7 },
  duplicateBadge: { alignSelf: 'flex-start', backgroundColor: Colors.urgentBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  duplicateBadgeText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.urgent },
  extractionRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  extractionInput: { flex: 1, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white, marginTop: 6 },
  extractionInputHalf: { flex: 1, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white },
  extractionInputSmall: { flex: 1, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white },
  extractionResultRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  extractingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  extractingCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 32, alignItems: 'center', gap: 16 },
  extractingText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  confirmCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  confirmLine: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.navy, lineHeight: 18 },
  confirmK: { fontFamily: Fonts.extrabold, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.4 },
  confirmFooter: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.background, gap: 4 },
  coralConfirm: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  coralConfirmTxt: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.white },
});
