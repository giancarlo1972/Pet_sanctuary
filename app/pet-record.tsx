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
} from 'lucide-react-native';
import { InlineBanner } from '@/components/InlineBanner';
import { ConfirmDialog, type ConfirmConfig } from '@/components/ConfirmDialog';
import { VetVaccinationModal, type Vaccination as FullVaccination, type VetClinic as ClinicInfo } from '@/components/VetVaccinationModal';
import { VetLabResults } from '@/components/VetLabResults';
import { VetClinics } from '@/components/VetClinics';
import { VetSummaryExport, type SummaryData } from '@/components/VetSummaryExport';
import SignedImage from '@/components/SignedImage';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { extFromAsset, extFromMimeType } from '@/lib/storage';

type Tab = 'overview' | 'medical' | 'labs' | 'clinics' | 'history' | 'people';

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
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function titleCase(value: string | null): string {
  if (!value) return '';
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

const DOCUMENT_KINDS = [
  { key: 'vaccination_record', label: 'Vaccination Record' },
  { key: 'medical_record', label: 'Medical Record' },
  { key: 'xray', label: 'X-Ray' },
  { key: 'ultrasound', label: 'Ultrasound' },
  { key: 'lab_result', label: 'Lab Result' },
  { key: 'other_imaging', label: 'Other Imaging' },
  { key: 'other_document', label: 'Other Document' },
];

const LB_PER_KG = 2.20462;

function kgToLb(kg: number): number {
  return Math.round(kg * LB_PER_KG * 10) / 10;
}

function lbToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 100) / 100;
}

export default function PetRecordScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [pet, setPet] = useState<Pet | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
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

  const [docModalVisible, setDocModalVisible] = useState(false);
  const [docForm, setDocForm] = useState({
    kind: 'medical_record', title: '', taken_on: '', clinic: '', notes: '',
  });
  const [docFile, setDocFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);

  const [extracting, setExtracting] = useState(false);
  const [extractionReview, setExtractionReview] = useState<{
    documentId: string;
    data: ExtractedData;
    extractionId: string;
    vaxDuplicates: Set<number>;
  } | null>(null);
  const [editableVax, setEditableVax] = useState<ExtractedVaccination[]>([]);
  const [editableLabs, setEditableLabs] = useState<ExtractedLabPanel[]>([]);
  const [editableWeight, setEditableWeight] = useState<ExtractedWeight>({ value: null, unit: null, measured_on: null });
  const [editableProcedures, setEditableProcedures] = useState<ExtractedProcedure[]>([]);
  const [applyingExtraction, setApplyingExtraction] = useState(false);

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

    const { data: petData, error: petErr } = await supabase
      .from('pets')
      .select('id, name, breed, species, age_text, gender, status, description, main_photo_url, location, shelter_id, owner_id, vaccinated, spayed_neutered, microchipped, weight_kg, weight_measured_on, primary_color, secondary_color, color_notes, breed_primary, breed_secondary, is_mixed, breed_notes, date_of_birth, body_condition_score, target_weight_kg, previous_names')
      .eq('id', petId)
      .maybeSingle();

    if (petErr || !petData) {
      setError('Could not load this pet record.');
      setLoading(false);
      return;
    }
    setPet(petData);

    const isOwner = petData.owner_id === user.id;
    const { data: myRels } = await supabase
      .from('pet_relationships')
      .select('id, relationship, ended_on')
      .eq('pet_id', petId)
      .eq('user_id', user.id)
      .is('ended_on', null);
    const isCurrentFoster = myRels?.some((r) => r.relationship === 'foster') ?? false;

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
    setCanEdit(isOwner || isCurrentFoster || isOrgStaff);

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
        .select('id, vaccine, administered_on, next_due_on, vet_clinic, vaccine_type, duration_years, vet_name, vet_license, lot_number, lot_expires_on, manufacturer, injection_site, tag_number, is_booster, superseded, notes, document_url, clinic_id')
        .eq('pet_id', petId)
        .order('administered_on', { ascending: false }),
      supabase.from('medical_records')
        .select('id, record_type, title, details, record_date')
        .eq('pet_id', petId)
        .order('record_date', { ascending: false }),
      supabase.from('pet_history_events')
        .select('id, event_type, occurred_on, description, public_summary')
        .eq('pet_id', petId)
        .order('occurred_on', { ascending: false }),
      supabase.from('pet_conditions')
        .select('id, pet_id, kind, name, severity, diagnosed_on, resolved_on, notes, is_active')
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
        .select('id, pet_id, kind, file_path, title, taken_on, clinic, notes')
        .eq('pet_id', petId)
        .order('created_at', { ascending: false }),
      supabase.from('pet_breeds').select('id, species, name, sort_order').order('species').order('sort_order'),
      supabase.from('pet_colors').select('id, name, sort_order').order('sort_order'),
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

    setVaccinations((vaxRes.data as Vaccination[]) || []);

    const { data: clinicData } = await supabase.from('vet_clinics').select('id, name, address, phone, website').order('name');
    setClinics((clinicData as ClinicInfo[]) || []);
    setMedicalRecords((medRes.data as MedicalRecord[]) || []);
    setHistoryEvents((histRes.data as HistoryEvent[]) || []);
    setConditions((condRes.data as PetCondition[]) || []);
    setDiet((dietRes.data as PetDiet) || null);
    setPhotos((photosRes.data as PetPhoto[]) || []);
    setDocuments((docsRes.data as PetDocument[]) || []);
    setBreeds((breedsRes.data as BreedOption[]) || []);
    setColors((colorsRes.data as ColorOption[]) || []);
    setLoading(false);
  }, [petId, user]);

  useEffect(() => { load(); }, [load]);

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
    const { error } = await supabase
      .from('pets')
      .update({
        breed_primary: breedForm.breed_primary || null,
        breed_secondary: breedForm.breed_secondary || null,
        is_mixed: breedForm.is_mixed,
        breed_notes: breedForm.breed_notes.trim() || null,
      })
      .eq('id', petId);
    if (error) { console.error('[pet-record] breed update:', error); showBanner(error.message || 'Could not save breed info.'); setSavingBreed(false); return; }
    setSavingBreed(false);
    setBreedModalVisible(false);
    load();
  };

  // === Color handlers ===
  const openColorModal = () => {
    setColorForm({
      primary_color: pet?.primary_color || '',
      secondary_color: pet?.secondary_color || '',
      color_notes: pet?.color_notes || '',
    });
    setColorModalVisible(true);
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
        const ext = extFromMimeType(file.type);
        const filePath = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('pet-documents').upload(filePath, file);
        if (upErr) { console.error('[pet-record] photo upload (web):', upErr); showBanner('Could not upload photo.'); setPhotoUploading(false); return; }
        const { error: insErr } = await supabase.from('pet_photos').insert({
          pet_id: petId,
          photo_url: filePath,
          sort_order: photos.length,
          is_profile: photos.length === 0,
          uploaded_by: user.id,
        });
        if (insErr) { console.error('[pet-record] photo insert (web):', insErr); showBanner('Could not add photo.'); setPhotoUploading(false); return; }
        if (photos.length === 0) {
          await supabase.from('pets').update({ main_photo_url: filePath }).eq('id', petId);
        }
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
    const ext = extFromAsset(asset);
    const mime = asset.mimeType || 'image/jpeg';
    const filePath = `${user.id}/${Date.now()}.${ext}`;
    const formData = new FormData();
    formData.append('file', { uri: asset.uri, type: mime, name: `photo.${ext}` } as any);
    const { error: upErr } = await supabase.storage.from('pet-documents').upload(filePath, formData);
    if (upErr) { console.error('[pet-record] photo upload:', upErr); showBanner('Could not upload photo.'); setPhotoUploading(false); return; }
    const { error: insErr } = await supabase.from('pet_photos').insert({
      pet_id: petId,
      photo_url: filePath,
      sort_order: photos.length,
      is_profile: photos.length === 0,
      uploaded_by: user.id,
    });
    if (insErr) { console.error('[pet-record] photo insert:', insErr); showBanner('Could not add photo.'); setPhotoUploading(false); return; }
    if (photos.length === 0) {
      await supabase.from('pets').update({ main_photo_url: filePath }).eq('id', petId);
    }
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
    setDocForm({ kind: 'medical_record', title: '', taken_on: '', clinic: '', notes: '' });
    setDocFile(null);
    setDocModalVisible(true);
  };

  const pickDocFile = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          setDocFile({ uri: URL.createObjectURL(file), name: file.name, mimeType: file.type } as any);
        }
      };
      input.click();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setDocFile(result.assets[0]);
    }
  };

  const saveDoc = async () => {
    if (!petId || !user || !docFile) return;
    setSavingDoc(true);
    const ext = extFromAsset(docFile as any);
    const filePath = `${user.id}/${Date.now()}.${ext}`;
    let uploadResult;
    if (Platform.OS === 'web') {
      const resp = await fetch(docFile.uri);
      const blob = await resp.blob();
      uploadResult = await supabase.storage.from('pet-documents').upload(filePath, blob);
    } else {
      const formData = new FormData();
      formData.append('file', { uri: docFile.uri, type: `application/octet-stream`, name: `doc.${ext}` } as any);
      uploadResult = await supabase.storage.from('pet-documents').upload(filePath, formData);
    }
    if (uploadResult.error) { console.error('[pet-record] doc upload:', uploadResult.error); showBanner(uploadResult.error.message || 'Could not upload document.'); setSavingDoc(false); return; }
    const { data: docData, error: insErr } = await supabase.from('pet_documents').insert({
      pet_id: petId,
      kind: docForm.kind,
      file_path: filePath,
      title: docForm.title.trim() || null,
      taken_on: docForm.taken_on || null,
      clinic: docForm.clinic.trim() || null,
      notes: docForm.notes.trim() || null,
      uploaded_by: user.id,
    }).select().single();
    if (insErr) { console.error('[pet-record] doc insert:', insErr); showBanner(insErr.message || 'Could not save document.'); setSavingDoc(false); return; }
    setSavingDoc(false);
    setDocModalVisible(false);
    load();

    // Trigger AI extraction for vet record types
    const vetDocKinds = ['vaccination_record', 'medical_record', 'lab_result'];
    if (vetDocKinds.includes(docForm.kind) && docData?.id) {
      triggerExtraction(docData.id);
    }
  };

  const triggerExtraction = async (documentId: string) => {
    if (!user) return;
    setExtracting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const resp = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/extract-vet-record`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session?.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ document_id: documentId }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) {
        console.error('[pet-record] extraction failed:', result.error);
        showBanner(result.error || 'AI extraction failed. The document was saved — you can enter details manually.', 'info');
        setExtracting(false);
        return;
      }

      // Fetch the extraction record to get the ID
      const { data: extData } = await supabase
        .from('document_extractions')
        .select('id, extracted')
        .eq('document_id', documentId)
        .maybeSingle();

      if (!extData || !extData.extracted || (extData.extracted as any) === '{}') {
        showBanner('AI could not extract data from this document. You can enter details manually.', 'info');
        setExtracting(false);
        return;
      }

      const extracted = extData.extracted as ExtractedData;

      // Check for vaccination duplicates
      const vaxDuplicates = new Set<number>();
      for (let i = 0; i < (extracted.vaccinations || []).length; i++) {
        const v = extracted.vaccinations[i];
        if (!v.vaccine || !v.administered_on) continue;
        const exists = vaccinations.some(
          (existing) => existing.vaccine === v.vaccine && existing.administered_on === v.administered_on
        );
        if (exists) vaxDuplicates.add(i);
      }

      // Populate editable state
      setEditableVax((extracted.vaccinations || []).map((v) => ({ ...v })));
      setEditableLabs((extracted.lab_panels || []).map((p) => ({ ...p, results: (p.results || []).map((r) => ({ ...r })) })));
      setEditableWeight(extracted.weight || { value: null, unit: null, measured_on: null });
      setEditableProcedures((extracted.procedures || []).map((p) => ({ ...p })));

      setExtractionReview({
        documentId,
        data: extracted,
        extractionId: extData.id,
        vaxDuplicates,
      });
    } catch (err) {
      console.error('[pet-record] extraction error:', err);
      showBanner('AI extraction failed. The document was saved — you can enter details manually.', 'info');
    }
    setExtracting(false);
  };

  const applyExtraction = async () => {
    if (!extractionReview || !petId || !user) return;
    setApplyingExtraction(true);

    try {
      const sourceDocId = extractionReview.documentId;
      let appliedCount = 0;
      const errors: string[] = [];

      // Insert non-duplicate vaccinations
      for (let i = 0; i < editableVax.length; i++) {
        if (extractionReview.vaxDuplicates.has(i)) continue;
        const v = editableVax[i];
        if (!v.vaccine) continue;
        const { error } = await supabase.from('pet_vaccinations').insert({
          pet_id: petId,
          vaccine: v.vaccine,
          administered_on: v.administered_on || null,
          next_due_on: v.next_due_on || null,
          duration_years: v.duration_years || null,
          manufacturer: v.manufacturer || null,
          lot_number: v.lot_number || null,
          lot_expires_on: v.lot_expires_on || null,
          injection_site: v.injection_site || null,
          vaccine_type: v.vaccine_type || null,
          tag_number: v.tag_number || null,
          vet_name: v.vet_name || null,
          vet_license: v.vet_license || null,
          vet_clinic: v.clinic_name || null,
          recorded_by: user.id,
          source_document_id: sourceDocId,
        });
        if (error) { console.error('[pet-record] vax insert from extraction:', error); errors.push(`Vaccination "${v.vaccine}": ${error.message}`); }
        else appliedCount++;
      }

      // Insert lab panels + results
      for (const panel of editableLabs) {
        if (!panel.panel_name) continue;
        const { data: panelData, error: panelErr } = await supabase.from('lab_panels').insert({
          pet_id: petId,
          panel_name: panel.panel_name,
          collected_on: panel.collected_on || null,
          vet_name: panel.vet_name || null,
          notes: null,
          recorded_by: user.id,
        }).select().single();
        if (panelErr) { console.error('[pet-record] lab panel insert:', panelErr); errors.push(`Lab panel "${panel.panel_name}": ${panelErr.message}`); continue; }

        for (const result of (panel.results || [])) {
          if (!result.analyte) continue;
          const { error: resErr } = await supabase.from('lab_results').insert({
            panel_id: panelData.id,
            analyte: result.analyte,
            value_num: result.value_num,
            value_text: result.value_text || null,
            unit: result.unit || null,
            ref_low: result.ref_low,
            ref_high: result.ref_high,
            flag: result.flag || null,
          });
          if (resErr) { console.error('[pet-record] lab result insert:', resErr); errors.push(`Lab result "${result.analyte}": ${resErr.message}`); }
          else appliedCount++;
        }
      }

      // Insert weight as care event + update pet
      if (editableWeight.value != null) {
        const kg = editableWeight.unit === 'lb' ? lbToKg(editableWeight.value) : editableWeight.value;
        const { error: petWtErr } = await supabase.from('pets').update({
          weight_kg: kg,
          weight_measured_on: editableWeight.measured_on || new Date().toISOString().slice(0, 10),
        }).eq('id', petId);
        if (petWtErr) { console.error('[pet-record] weight from extraction:', petWtErr); errors.push(`Weight: ${petWtErr.message}`); }
        else {
          const { error: evtErr } = await supabase.from('pet_care_events').insert({
            pet_id: petId,
            event_type: 'weight',
            occurred_on: editableWeight.measured_on || new Date().toISOString().slice(0, 10),
            title: 'Weight recorded (from document)',
            notes: `${editableWeight.value} ${editableWeight.unit || 'kg'}`,
            weight_kg: kg,
            recorded_by: user.id,
            source_document_id: sourceDocId,
          });
          if (evtErr) console.error('[pet-record] weight event from extraction:', evtErr);
          else appliedCount++;
        }
      }

      // Insert procedures as care events
      for (const proc of editableProcedures) {
        if (!proc.title && !proc.event_type) continue;
        const { error } = await supabase.from('pet_care_events').insert({
          pet_id: petId,
          event_type: proc.event_type || 'procedure',
          occurred_on: proc.occurred_on || null,
          title: proc.title || null,
          notes: proc.notes || null,
          cost_cents: proc.cost_cents || null,
          recorded_by: user.id,
          source_document_id: sourceDocId,
        });
        if (error) { console.error('[pet-record] procedure insert from extraction:', error); errors.push(`Procedure "${proc.title}": ${error.message}`); }
        else appliedCount++;
      }

      // Mark extraction as applied
      await supabase.from('document_extractions').update({
        status: 'applied',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', extractionReview.extractionId);

      if (errors.length > 0) {
        showBanner(`Applied ${appliedCount} items. Some items had errors: ${errors.slice(0, 2).join('; ')}`, 'info');
      } else {
        showBanner(`Applied ${appliedCount} item${appliedCount !== 1 ? 's' : ''} from the document.`, 'success');
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

  const breedDisplay = [pet.breed_primary, pet.breed_secondary].filter(Boolean).join(' / ')
    || pet.breed || '—';
  const colorDisplay = [pet.primary_color, pet.secondary_color].filter(Boolean).join(' / ') || '—';
  const weightDisplay = pet.weight_kg != null
    ? (weightUnit === 'lb' ? `${kgToLb(pet.weight_kg)} lb` : `${Math.round(pet.weight_kg * 100) / 100} kg`)
    : '—';
  const currentRels = relationships.filter((r) => !r.ended_on);
  const pastRels = relationships.filter((r) => r.ended_on);
  const activeConditions = conditions.filter((c) => c.is_active);
  const resolvedConditions = conditions.filter((c) => !c.is_active);

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: PawPrint },
    { key: 'medical', label: 'Medical', icon: Stethoscope },
    { key: 'labs', label: 'Labs', icon: FlaskConical },
    { key: 'clinics', label: 'Clinics', icon: Building2 },
    { key: 'history', label: 'History', icon: ClipboardCheck },
    { key: 'people', label: 'People', icon: Users },
  ];

  const filteredBreeds = breeds.filter((b) => {
    if (pet.species === 'dog' || pet.species === 'Dog') return b.species === 'dog';
    if (pet.species === 'cat' || pet.species === 'Cat') return b.species === 'cat';
    return true;
  }).filter((b) => b.name.toLowerCase().includes(breedSearch.toLowerCase()));

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()} activeOpacity={0.75}>
          <ArrowLeft color={Colors.text} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pet.name || 'Pet Record'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {banner && (
          <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />
        )}
        {/* Pet banner */}
        <View style={styles.petBanner}>
          {pet.main_photo_url ? (
            <SignedImage path={pet.main_photo_url} style={styles.petPhoto} />
          ) : (
            <View style={[styles.petPhoto, styles.petPhotoFallback]}>
              <PawPrint color={Colors.textTertiary} size={28} />
            </View>
          )}
          <View style={styles.petBannerInfo}>
            <Text style={styles.petName}>{pet.name || 'Unnamed'}{pet.previous_names?.length ? ` (formerly ${pet.previous_names.join(', ')})` : ''}</Text>
            {breedDisplay !== '—' ? <Text style={styles.petMeta}>{breedDisplay}{pet.is_mixed ? ' (Mixed)' : ''}</Text> : null}
            {pet.age_text ? <Text style={styles.petMeta}>{pet.age_text}</Text> : null}
            {pet.gender ? <Text style={styles.petMeta}>{titleCase(pet.gender)}</Text> : null}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(t.key)}
                activeOpacity={0.85}
              >
                <Icon color={active ? Colors.coral : Colors.textTertiary} size={16} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <View style={styles.tabContent}>
            {/* Photo gallery */}
            <View style={styles.subHeader}>
              <View style={styles.subHeaderLeft}>
                <ImageIcon color={Colors.navy} size={18} />
                <Text style={styles.subHeaderText}>Photos</Text>
              </View>
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
                    {canEdit && !photo.is_profile && i > 0 && (
                      <Text style={styles.photoHint}>Tap to set profile</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Info card */}
            <View style={styles.infoCard}>
              <InfoRow icon={<PawPrint color={Colors.navy} size={16} />} label="Species" value={titleCase(pet.species)} />
              <InfoRow icon={<Home color={Colors.navy} size={16} />} label="Breed" value={breedDisplay} />
              {pet.is_mixed ? <InfoRow icon={<PawPrint color={Colors.navy} size={16} />} label="Mixed Breed" value="Yes" /> : null}
              {pet.breed_notes ? <InfoRow icon={<PawPrint color={Colors.navy} size={16} />} label="Breed Notes" value={pet.breed_notes} /> : null}
              <InfoRow icon={<Palette color={Colors.navy} size={16} />} label="Color" value={colorDisplay} />
              {pet.color_notes ? <InfoRow icon={<Palette color={Colors.navy} size={16} />} label="Color Notes" value={pet.color_notes} /> : null}
              <InfoRow icon={<Scale color={Colors.navy} size={16} />} label="Weight" value={weightDisplay} />
              {pet.body_condition_score != null ? <InfoRow icon={<Scale color={Colors.navy} size={16} />} label="Body Condition" value={`${pet.body_condition_score}/9`} /> : null}
              {pet.target_weight_kg != null ? <InfoRow icon={<Scale color={Colors.navy} size={16} />} label="Target Weight" value={weightUnit === 'lb' ? `${kgToLb(pet.target_weight_kg)} lb` : `${Math.round(pet.target_weight_kg * 100) / 100} kg`} /> : null}
              {pet.weight_measured_on ? <InfoRow icon={<Calendar color={Colors.navy} size={16} />} label="Weighed On" value={formatDate(pet.weight_measured_on)} /> : null}
              {pet.date_of_birth ? <InfoRow icon={<Calendar color={Colors.navy} size={16} />} label="Date of Birth" value={formatDate(pet.date_of_birth)} /> : null}
              <InfoRow icon={<Calendar color={Colors.navy} size={16} />} label="Age" value={pet.age_text || '—'} />
              <InfoRow icon={<Shield color={Colors.navy} size={16} />} label="Vaccinated" value={pet.vaccinated ? 'Yes' : 'No'} />
              <InfoRow icon={<Shield color={Colors.navy} size={16} />} label="Spayed/Neutered" value={pet.spayed_neutered ? 'Yes' : 'No'} />
              <InfoRow icon={<Shield color={Colors.navy} size={16} />} label="Microchipped" value={pet.microchipped ? 'Yes' : 'No'} />
              {pet.location ? <InfoRow icon={<Home color={Colors.navy} size={16} />} label="Location" value={pet.location} /> : null}
            </View>

            {canEdit && (
              <View style={styles.editActionsRow}>
                <TouchableOpacity style={styles.editActionBtn} onPress={openBreedModal} activeOpacity={0.85}>
                  <Pencil color={Colors.navy} size={14} />
                  <Text style={styles.editActionText}>Edit Breed</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editActionBtn} onPress={openColorModal} activeOpacity={0.85}>
                  <Pencil color={Colors.navy} size={14} />
                  <Text style={styles.editActionText}>Edit Color</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editActionBtn} onPress={openWeight} activeOpacity={0.85}>
                  <Scale color={Colors.navy} size={14} />
                  <Text style={styles.editActionText}>Record Weight</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Diet section — prominent for foster/sitter */}
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
              <View style={styles.dietCard}>
                {diet.food_brand ? <DietRow label="Brand" value={diet.food_brand} /> : null}
                {diet.food_product ? <DietRow label="Product" value={diet.food_product} /> : null}
                {diet.food_type ? <DietRow label="Type" value={titleCase(diet.food_type)} /> : null}
                {diet.portion ? <DietRow label="Portion" value={diet.portion} /> : null}
                {diet.meals_per_day ? <DietRow label="Meals/day" value={String(diet.meals_per_day)} /> : null}
                {diet.treats ? <DietRow label="Treats" value={diet.treats} /> : null}
                {diet.avoid ? <DietRow label="Avoid" value={diet.avoid} /> : null}
                {diet.feeding_notes ? <DietRow label="Notes" value={diet.feeding_notes} /> : null}
              </View>
            ) : (
              <Text style={styles.emptyText}>No diet information yet. This is essential for foster and sitter handoff.</Text>
            )}

            <Text style={styles.sectionLabel}>Current Relationship</Text>
            {currentRels.length === 0 ? (
              <Text style={styles.emptyText}>No active relationships.</Text>
            ) : (
              currentRels.map((r) => (
                <View key={r.id} style={styles.relCard}>
                  <View style={styles.relBadge}>
                    <Text style={styles.relBadgeText}>{titleCase(r.relationship)}</Text>
                  </View>
                  <Text style={styles.relName}>{r.profile_name}</Text>
                  <Text style={styles.relDate}>Since {formatDate(r.started_on)}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* MEDICAL */}
        {tab === 'medical' && (
          <View style={styles.tabContent}>
            {/* Conditions */}
            <View style={styles.subHeader}>
              <View style={styles.subHeaderLeft}>
                <Heart color={Colors.navy} size={18} />
                <Text style={styles.subHeaderText}>Conditions & Allergies</Text>
              </View>
              {canEdit && (
                <TouchableOpacity style={styles.addBtn} onPress={openAddCondition} activeOpacity={0.85}>
                  <Plus color={Colors.coral} size={16} />
                  <Text style={styles.addBtnText}>Add</Text>
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
                      <View key={c.id} style={[styles.condCard, { opacity: 0.65 }]}>
                        <Text style={styles.condName}>{c.name}</Text>
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
                <TouchableOpacity style={styles.addBtn} onPress={openAddVax} activeOpacity={0.85}>
                  <Plus color={Colors.coral} size={16} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            {vaccinations.length === 0 ? (
              <Text style={styles.emptyText}>No vaccinations recorded.</Text>
            ) : (
              (() => {
                const activeVax = vaccinations.filter((v) => !v.superseded);
                const supersededVax = vaccinations.filter((v) => v.superseded);
                return (
                  <>
                    {activeVax.map((vax) => {
                      const status = vaccinationStatus(vax.next_due_on);
                      return (
                        <View key={vax.id} style={[
                          styles.vaxCard,
                          status === 'overdue' && styles.vaxCardOverdue,
                          status === 'due-soon' && styles.vaxCardDueSoon,
                        ]}>
                          <View style={styles.vaxTopRow}>
                            <Text style={styles.vaxName}>{vax.vaccine}</Text>
                            {vax.is_booster ? <Text style={styles.boosterTag}>Booster</Text> : null}
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
                            {status === 'ok' && (
                              <View style={[styles.vaxStatusPill, { backgroundColor: Colors.tealBg }]}>
                                <Text style={[styles.vaxStatusText, { color: Colors.tealDark }]}>Valid through {formatDate(vax.next_due_on)}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.vaxDetail}>Given: {formatDate(vax.administered_on)}</Text>
                          <Text style={styles.vaxDetail}>Next due: {formatDate(vax.next_due_on)}</Text>
                          {vax.vet_clinic ? <Text style={styles.vaxDetail}>Clinic: {vax.vet_clinic}</Text> : null}
                          {vax.vet_name ? <Text style={styles.vaxDetail}>Vet: {vax.vet_name}</Text> : null}
                          {vax.lot_number ? <Text style={styles.vaxDetail}>Lot: {vax.lot_number}{vax.lot_expires_on ? ` (expires ${formatDate(vax.lot_expires_on)})` : ''}</Text> : null}
                          {vax.manufacturer ? <Text style={styles.vaxDetail}>Mfr: {vax.manufacturer}</Text> : null}
                          {vax.injection_site ? <Text style={styles.vaxDetail}>Site: {vax.injection_site}</Text> : null}
                          {vax.tag_number ? <Text style={styles.vaxDetail}>Tag: {vax.tag_number}</Text> : null}
                          {vax.vet_license ? <Text style={styles.vaxDetail}>Vet license: {vax.vet_license}</Text> : null}
                          {vax.notes ? <Text style={styles.vaxNotes}>{vax.notes}</Text> : null}
                          {canEdit && (
                            <View style={styles.vaxActions}>
                              <TouchableOpacity style={styles.vaxEditBtn} onPress={() => openEditVax(vax)} activeOpacity={0.85}>
                                <Text style={styles.vaxEditText}>Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.vaxDeleteBtn} onPress={() => deleteVax(vax.id)} activeOpacity={0.85}>
                                <Trash2 color={Colors.critical} size={14} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                    {supersededVax.length > 0 && (
                      <Text style={[styles.sectionLabel, { marginTop: 12 }]}>History ({supersededVax.length})</Text>
                    )}
                    {supersededVax.map((vax) => (
                      <View key={vax.id} style={[styles.vaxCard, { opacity: 0.55 }]}>
                        <View style={styles.vaxTopRow}>
                          <Text style={styles.vaxName}>{vax.vaccine}</Text>
                          <Text style={[styles.vaxStatusText, { color: Colors.textTertiary }]}>Superseded</Text>
                        </View>
                        <Text style={styles.vaxDetail}>Given: {formatDate(vax.administered_on)}</Text>
                      </View>
                    ))}
                  </>
                );
              })()
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
                weight_kg: pet.weight_kg,
                body_condition_score: pet.body_condition_score,
                target_weight_kg: pet.target_weight_kg,
                previous_names: pet.previous_names,
              },
              vaccinations: vaccinations.filter((v) => !v.superseded).map((v) => ({
                vaccine: v.vaccine,
                administered_on: v.administered_on,
                next_due_on: v.next_due_on,
                lot_number: v.lot_number,
                manufacturer: v.manufacturer,
                vet_clinic: v.vet_clinic,
                vet_name: v.vet_name,
              })),
              conditions: conditions.map((c) => ({
                kind: c.kind,
                name: c.name,
                severity: c.severity,
                diagnosed_on: c.diagnosed_on,
                is_active: c.is_active,
              })),
              labPanels: [],
              clinics: [],
            }} />

            {/* Documents */}
            <View style={styles.subHeader}>
              <View style={styles.subHeaderLeft}>
                <FileText color={Colors.navy} size={18} />
                <Text style={styles.subHeaderText}>Documents</Text>
              </View>
              {canEdit && (
                <TouchableOpacity style={styles.addBtn} onPress={openAddDoc} activeOpacity={0.85}>
                  <Plus color={Colors.coral} size={16} />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            {documents.length === 0 ? (
              <Text style={styles.emptyText}>No documents uploaded.</Text>
            ) : (
              documents.map((doc) => (
                <View key={doc.id} style={styles.docCard}>
                  <TouchableOpacity style={styles.docMain} onPress={() => openDocUrl(doc)} activeOpacity={0.85}>
                    <View style={styles.docIcon}>
                      <FileText color={Colors.navy} size={18} />
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={styles.docTitle}>{doc.title || DOCUMENT_KINDS.find((d) => d.key === doc.kind)?.label || titleCase(doc.kind)}</Text>
                      {doc.taken_on ? <Text style={styles.docDate}>{formatDate(doc.taken_on)}</Text> : null}
                      {doc.clinic ? <Text style={styles.docClinic}>{doc.clinic}</Text> : null}
                      {doc.notes ? <Text style={styles.docNotes}>{doc.notes}</Text> : null}
                    </View>
                  </TouchableOpacity>
                  {canEdit && (
                    <TouchableOpacity style={styles.docDeleteBtn} onPress={() => deleteDoc(doc)} activeOpacity={0.85}>
                      <Trash2 color={Colors.critical} size={14} />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}

            {/* Medical Records */}
            <View style={styles.subHeader}>
              <View style={styles.subHeaderLeft}>
                <Stethoscope color={Colors.navy} size={18} />
                <Text style={styles.subHeaderText}>Medical Records</Text>
              </View>
            </View>
            {medicalRecords.length === 0 ? (
              <Text style={styles.emptyText}>No medical records.</Text>
            ) : (
              medicalRecords.map((rec) => (
                <View key={rec.id} style={styles.medCard}>
                  <View style={styles.medTopRow}>
                    <View style={styles.medBadge}>
                      <Text style={styles.medBadgeText}>{titleCase(rec.record_type) || 'Record'}</Text>
                    </View>
                    <Text style={styles.medDate}>{formatDate(rec.record_date)}</Text>
                  </View>
                  {rec.title ? <Text style={styles.medTitle}>{rec.title}</Text> : null}
                </View>
              ))
            )}
          </View>
        )}

        {/* LABS */}
        {tab === 'labs' && (
          <View style={styles.tabContent}>
            <VetLabResults petId={petId} userId={user!.id} clinics={clinics} canEdit={canEdit} />
          </View>
        )}

        {/* CLINICS */}
        {tab === 'clinics' && (
          <View style={styles.tabContent}>
            <VetClinics petId={petId} userId={user!.id} canEdit={canEdit} />
          </View>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <View style={styles.tabContent}>
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

        {/* PEOPLE */}
        {tab === 'people' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionLabel}>Current</Text>
            {currentRels.length === 0 ? (
              <Text style={styles.emptyText}>No current relationships.</Text>
            ) : (
              currentRels.map((r) => (
                <View key={r.id} style={styles.personCard}>
                  <View style={styles.personAvatar}>
                    <Text style={styles.personInitial}>{(r.profile_name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.personInfo}>
                    <Text style={styles.personName}>{r.profile_name}</Text>
                    <Text style={styles.personRole}>{titleCase(r.relationship)} · Since {formatDate(r.started_on)}</Text>
                  </View>
                </View>
              ))
            )}

            {pastRels.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Past</Text>
                {pastRels.map((r) => (
                  <View key={r.id} style={[styles.personCard, styles.personCardPast]}>
                    <View style={[styles.personAvatar, styles.personAvatarPast]}>
                      <Text style={[styles.personInitial, styles.personInitialPast]}>{(r.profile_name || '?').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.personInfo}>
                      <Text style={[styles.personName, styles.personNamePast]}>{r.profile_name}</Text>
                      <Text style={styles.personRole}>{titleCase(r.relationship)} · {formatDate(r.started_on)} – {formatDate(r.ended_on)}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>

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
              <TextInput style={styles.modalInput} value={conditionForm.name} onChangeText={(v) => setConditionForm((p) => ({ ...p, name: v }))} placeholder="e.g. Hip dysplasia, Chicken allergy" placeholderTextColor={Colors.textTertiary} />
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
              <Text style={styles.modalLabel}>Diagnosed on (YYYY-MM-DD)</Text>
              <TextInput style={styles.modalInput} value={conditionForm.diagnosed_on} onChangeText={(v) => setConditionForm((p) => ({ ...p, diagnosed_on: v }))} placeholder="2024-06-01" placeholderTextColor={Colors.textTertiary} />
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
                  <Text style={styles.modalLabel}>Resolved on (YYYY-MM-DD)</Text>
                  <TextInput style={styles.modalInput} value={conditionForm.resolved_on} onChangeText={(v) => setConditionForm((p) => ({ ...p, resolved_on: v }))} placeholder="2025-01-15" placeholderTextColor={Colors.textTertiary} />
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
      <Modal visible={selectingBreedField !== null && breedModalVisible} animationType="fade" transparent onRequestClose={() => setSelectingBreedField(null)}>
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
                  if (selectingBreedField === 'primary') setBreedForm((p) => ({ ...p, breed_primary: item.name }));
                  else setBreedForm((p) => ({ ...p, breed_secondary: item.name }));
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

      {/* === Color Search Sub-Modal === */}
      <Modal visible={selectingColorField !== null && colorModalVisible} animationType="fade" transparent onRequestClose={() => setSelectingColorField(null)}>
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
                <Text style={styles.modalTitle}>Add Document</Text>
                <TouchableOpacity onPress={() => setDocModalVisible(false)}>
                  <Text style={styles.modalCloseText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.modalLabel}>Document Type</Text>
              <View style={styles.pillRow}>
                {DOCUMENT_KINDS.map((dk) => (
                  <TouchableOpacity key={dk.key} style={[styles.pill, docForm.kind === dk.key && styles.pillActive]} onPress={() => setDocForm((p) => ({ ...p, kind: dk.key }))} activeOpacity={0.85}>
                    <Text style={[styles.pillText, docForm.kind === dk.key && styles.pillTextActive]}>{dk.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.modalLabel}>Title</Text>
              <TextInput style={styles.modalInput} value={docForm.title} onChangeText={(v) => setDocForm((p) => ({ ...p, title: v }))} placeholder="e.g. Chest X-Ray, Blood Panel" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.modalLabel}>Date Taken (YYYY-MM-DD)</Text>
              <TextInput style={styles.modalInput} value={docForm.taken_on} onChangeText={(v) => setDocForm((p) => ({ ...p, taken_on: v }))} placeholder="2025-01-15" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.modalLabel}>Clinic</Text>
              <TextInput style={styles.modalInput} value={docForm.clinic} onChangeText={(v) => setDocForm((p) => ({ ...p, clinic: v }))} placeholder="e.g. Riverside Animal Hospital" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.modalLabel}>Notes</Text>
              <TextInput style={[styles.modalInput, styles.modalInputMultiline]} value={docForm.notes} onChangeText={(v) => setDocForm((p) => ({ ...p, notes: v }))} placeholder="Findings, observations" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} />
              <Text style={styles.modalLabel}>File *</Text>
              <TouchableOpacity style={styles.filePickBtn} onPress={pickDocFile} activeOpacity={0.85}>
                <FileText color={Colors.navy} size={18} />
                <Text style={styles.filePickText}>{docFile ? 'File selected' : 'Choose file...'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSubmitBtn, savingDoc && styles.btnDisabled]} onPress={saveDoc} disabled={savingDoc || !docFile} activeOpacity={0.85}>
                {savingDoc ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSubmitText}>Upload Document</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <ConfirmDialog config={confirmConfig} onClose={() => setConfirmConfig(null)} />

      {/* === Extraction Review Modal === */}
      {extractionReview && (
        <Modal visible={true} animationType="slide" transparent onRequestClose={() => setExtractionReview(null)}>
          <View style={styles.modalOverlay}>
            <ScrollView style={styles.modalScroll}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Review AI Extraction</Text>
                  <TouchableOpacity onPress={() => setExtractionReview(null)}>
                    <Text style={styles.modalCloseText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.extractionSummary}>
                  We found {editableVax.length} vaccination{editableVax.length !== 1 ? 's' : ''},
                  {' '}{editableLabs.length} lab panel{editableLabs.length !== 1 ? 's' : ''}
                  {editableWeight.value != null ? ' and a weight' : ''}
                  {' '}— check these before saving.
                </Text>

                {/* Vaccinations */}
                {editableVax.length > 0 && (
                  <View style={styles.extractionSection}>
                    <Text style={styles.extractionSectionTitle}>Vaccinations</Text>
                    {editableVax.map((vax, i) => (
                      <View key={i} style={[styles.extractionItem, extractionReview.vaxDuplicates.has(i) && styles.extractionItemDuplicate]}>
                        {extractionReview.vaxDuplicates.has(i) && (
                          <View style={styles.duplicateBadge}>
                            <Text style={styles.duplicateBadgeText}>Already recorded</Text>
                          </View>
                        )}
                        <TextInput style={styles.extractionInput} value={vax.vaccine || ''} onChangeText={(val) => setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, vaccine: val } : v))} placeholder="Vaccine name" placeholderTextColor={Colors.textTertiary} />
                        <View style={styles.extractionRow}>
                          <TextInput style={styles.extractionInputHalf} value={vax.administered_on || ''} onChangeText={(val) => setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, administered_on: val } : v))} placeholder="Given (YYYY-MM-DD)" placeholderTextColor={Colors.textTertiary} />
                          <TextInput style={styles.extractionInputHalf} value={vax.next_due_on || ''} onChangeText={(val) => setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, next_due_on: val } : v))} placeholder="Next due (YYYY-MM-DD)" placeholderTextColor={Colors.textTertiary} />
                        </View>
                        <TextInput style={styles.extractionInput} value={vax.manufacturer || ''} onChangeText={(val) => setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, manufacturer: val } : v))} placeholder="Manufacturer" placeholderTextColor={Colors.textTertiary} />
                        <View style={styles.extractionRow}>
                          <TextInput style={styles.extractionInputHalf} value={vax.lot_number || ''} onChangeText={(val) => setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, lot_number: val } : v))} placeholder="Lot number" placeholderTextColor={Colors.textTertiary} />
                          <TextInput style={styles.extractionInputHalf} value={vax.clinic_name || ''} onChangeText={(val) => setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, clinic_name: val } : v))} placeholder="Clinic" placeholderTextColor={Colors.textTertiary} />
                        </View>
                        <View style={styles.extractionRow}>
                          <TextInput style={styles.extractionInputHalf} value={vax.vet_name || ''} onChangeText={(val) => setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, vet_name: val } : v))} placeholder="Vet name" placeholderTextColor={Colors.textTertiary} />
                          <TextInput style={styles.extractionInputHalf} value={vax.vet_license || ''} onChangeText={(val) => setEditableVax((prev) => prev.map((v, idx) => idx === i ? { ...v, vet_license: val } : v))} placeholder="Vet license" placeholderTextColor={Colors.textTertiary} />
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Lab Panels */}
                {editableLabs.length > 0 && (
                  <View style={styles.extractionSection}>
                    <Text style={styles.extractionSectionTitle}>Lab Panels</Text>
                    {editableLabs.map((panel, pi) => (
                      <View key={pi} style={styles.extractionItem}>
                        <TextInput style={styles.extractionInput} value={panel.panel_name || ''} onChangeText={(val) => setEditableLabs((prev) => prev.map((p, idx) => idx === pi ? { ...p, panel_name: val } : p))} placeholder="Panel name" placeholderTextColor={Colors.textTertiary} />
                        <View style={styles.extractionRow}>
                          <TextInput style={styles.extractionInputHalf} value={panel.collected_on || ''} onChangeText={(val) => setEditableLabs((prev) => prev.map((p, idx) => idx === pi ? { ...p, collected_on: val } : p))} placeholder="Collected (YYYY-MM-DD)" placeholderTextColor={Colors.textTertiary} />
                          <TextInput style={styles.extractionInputHalf} value={panel.vet_name || ''} onChangeText={(val) => setEditableLabs((prev) => prev.map((p, idx) => idx === pi ? { ...p, vet_name: val } : p))} placeholder="Vet name" placeholderTextColor={Colors.textTertiary} />
                        </View>
                        {(panel.results || []).map((result, ri) => (
                          <View key={ri} style={styles.extractionResultRow}>
                            <TextInput style={styles.extractionInputSmall} value={result.analyte || ''} onChangeText={(val) => setEditableLabs((prev) => prev.map((p, idx) => idx === pi ? { ...p, results: p.results.map((r, ridx) => ridx === ri ? { ...r, analyte: val } : r) } : p))} placeholder="Analyte" placeholderTextColor={Colors.textTertiary} />
                            <TextInput style={styles.extractionInputSmall} value={result.value_text || (result.value_num != null ? String(result.value_num) : '')} onChangeText={(val) => setEditableLabs((prev) => prev.map((p, idx) => idx === pi ? { ...p, results: p.results.map((r, ridx) => ridx === ri ? { ...r, value_text: val, value_num: null } : r) } : p))} placeholder="Value" placeholderTextColor={Colors.textTertiary} />
                            <TextInput style={styles.extractionInputSmall} value={result.unit || ''} onChangeText={(val) => setEditableLabs((prev) => prev.map((p, idx) => idx === pi ? { ...p, results: p.results.map((r, ridx) => ridx === ri ? { ...r, unit: val } : r) } : p))} placeholder="Unit" placeholderTextColor={Colors.textTertiary} />
                            <TextInput style={styles.extractionInputSmall} value={result.flag || ''} onChangeText={(val) => setEditableLabs((prev) => prev.map((p, idx) => idx === pi ? { ...p, results: p.results.map((r, ridx) => ridx === ri ? { ...r, flag: val } : r) } : p))} placeholder="Flag" placeholderTextColor={Colors.textTertiary} />
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                )}

                {/* Weight */}
                {editableWeight.value != null && (
                  <View style={styles.extractionSection}>
                    <Text style={styles.extractionSectionTitle}>Weight</Text>
                    <View style={styles.extractionItem}>
                      <View style={styles.extractionRow}>
                        <TextInput style={styles.extractionInputHalf} value={String(editableWeight.value || '')} onChangeText={(val) => setEditableWeight((prev) => ({ ...prev, value: parseFloat(val) || null }))} placeholder="Weight" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
                        <TextInput style={styles.extractionInputHalf} value={editableWeight.unit || ''} onChangeText={(val) => setEditableWeight((prev) => ({ ...prev, unit: val }))} placeholder="Unit (kg/lb)" placeholderTextColor={Colors.textTertiary} />
                      </View>
                      <TextInput style={styles.extractionInput} value={editableWeight.measured_on || ''} onChangeText={(val) => setEditableWeight((prev) => ({ ...prev, measured_on: val }))} placeholder="Measured on (YYYY-MM-DD)" placeholderTextColor={Colors.textTertiary} />
                    </View>
                  </View>
                )}

                {/* Procedures */}
                {editableProcedures.length > 0 && (
                  <View style={styles.extractionSection}>
                    <Text style={styles.extractionSectionTitle}>Procedures</Text>
                    {editableProcedures.map((proc, i) => (
                      <View key={i} style={styles.extractionItem}>
                        <View style={styles.extractionRow}>
                          <TextInput style={styles.extractionInputHalf} value={proc.event_type || ''} onChangeText={(val) => setEditableProcedures((prev) => prev.map((p, idx) => idx === i ? { ...p, event_type: val } : p))} placeholder="Type (e.g. surgery)" placeholderTextColor={Colors.textTertiary} />
                          <TextInput style={styles.extractionInputHalf} value={proc.occurred_on || ''} onChangeText={(val) => setEditableProcedures((prev) => prev.map((p, idx) => idx === i ? { ...p, occurred_on: val } : p))} placeholder="Date (YYYY-MM-DD)" placeholderTextColor={Colors.textTertiary} />
                        </View>
                        <TextInput style={styles.extractionInput} value={proc.title || ''} onChangeText={(val) => setEditableProcedures((prev) => prev.map((p, idx) => idx === i ? { ...p, title: val } : p))} placeholder="Title" placeholderTextColor={Colors.textTertiary} />
                        <TextInput style={[styles.extractionInput, styles.modalInputMultiline]} value={proc.notes || ''} onChangeText={(val) => setEditableProcedures((prev) => prev.map((p, idx) => idx === i ? { ...p, notes: val } : p))} placeholder="Notes" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={2} />
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity style={[styles.modalSubmitBtn, applyingExtraction && styles.btnDisabled]} onPress={applyExtraction} disabled={applyingExtraction} activeOpacity={0.85}>
                  {applyingExtraction ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSubmitText}>Save Confirmed Items</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* Extracting indicator */}
      {extracting && (
        <Modal visible={true} animationType="fade" transparent>
          <View style={styles.extractingOverlay}>
            <View style={styles.extractingCard}>
              <ActivityIndicator size="large" color={Colors.coral} />
              <Text style={styles.extractingText}>Analyzing document with AI...</Text>
            </View>
          </View>
        </Modal>
      )}
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
  petBannerInfo: { flex: 1 },
  petName: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text },
  petMeta: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  tabBar: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: Colors.coral },
  tabText: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.textTertiary },
  tabTextActive: { color: Colors.coral, fontFamily: Fonts.bold },

  tabContent: { padding: 20 },

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
});
