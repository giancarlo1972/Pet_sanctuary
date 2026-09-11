import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { InlineBanner } from '@/components/InlineBanner';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '@/hooks/useSafeBack';
import {
  ArrowLeft,
  ShieldCheck,
  Check,
  PawPrint,
  Lock,
  Phone,
  Mail,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import SignedImage from '@/components/SignedImage';
import { SegmentedTabs } from '@/components/Tabs';


interface PetRecord {
  id: string;
  name: string;
  breed: string | null;
  species: string;
  age_text: string | null;
  dob?: string | null;
  gender: string | null;
  status: string;
  availability: string;
  description: string | null;
  main_photo_url: string | null;
  location: string | null;
  personality: string[] | null;
  good_with_kids: boolean;
  good_with_dogs: boolean;
  good_with_cats: boolean;
  vaccinated: boolean;
  spayed_neutered: boolean;
  microchipped: boolean;
  dewormed?: boolean;
  felv_fiv_negative?: boolean;
  shelter_id: string | null;
  org_name?: string | null;
  listing_phone?: string | null;
  listing_email?: string | null;
  size?: string | null;
  coat?: string | null;
  house_trained?: string | null;
  special_needs?: string | null;
  adoption_fee?: string | null;
  color?: string | null;
  energy?: string | null;
  good_with_kids_text?: string | null;
  good_with_dogs_text?: string | null;
  good_with_cats_text?: string | null;
}

interface MedicalRecord {
  id: string;
  record_date: string;
  title: string;
  notes: string | null;
  provider_name: string | null;
}

interface AdoptionHistoryItem {
  id: string;
  period: string | null;
  event: string;
  note: string | null;
  created_at: string;
}

interface LinkedReport {
  id: string;
  report_type: string;
  severity: string | null;
  status: string;
}

interface AccessRequest {
  id: string;
  status: string;
  scope: string;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  lost: 'Lost Pet',
  stray: 'Stray Pet',
  foster: 'Foster Request',
  support: 'Support Request',
  inform: 'Authority Report',
  emergency: 'Emergency',
  road_accident: 'Road Accident',
  injured: 'Injured Animal',
  lost_found: 'Lost/Found',
  cruelty: 'Cruelty/Neglect',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatShortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function decodeHtml(value: string | null | undefined) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n);
      return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const c = parseInt(h, 16);
      return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : _;
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseWord(word: string) {
  if (!word) return '';
  if (/^[A-Z]{2,4}$/.test(word) && word.length <= 3) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function titleCaseName(value: string | null | undefined) {
  const raw = decodeHtml(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  const parts = raw.split(/\s+aka\s+/i);
  const title = (s: string) => s.split(/\s+/).map(titleCaseWord).join(' ');
  if (parts.length > 1) return `${title(parts[0])} (aka ${parts.slice(1).map(title).join(', ')})`;
  return title(raw);
}

function firstName(value: string | null | undefined) {
  const token = String(value || '').split(/\s|aka/i).map((s) => s.trim()).find(Boolean) || '';
  return titleCaseName(token) || 'me';
}

function compactAge(ageText?: string | null, dob?: string | null) {
  const raw = String(ageText || '').trim();
  const years = raw.match(/(\d+(?:\.\d+)?)\s*(y|yr|year)/i);
  if (years) {
    const n = Number(years[1]);
    if (n >= 1) return `${Math.round(n)} y`;
    return `${Math.max(1, Math.round(n * 12))} mo`;
  }
  const months = raw.match(/(\d+)\s*(mo|month)/i);
  if (months) return `${months[1]} mo`;
  if (dob) {
    const m = String(dob).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const y = (Date.now() - new Date(+m[1], +m[2] - 1, +m[3]).getTime()) / (365.25 * 864e5);
      if (y >= 1) return `${Math.round(y)} y`;
      return `${Math.max(1, Math.round(y * 12))} mo`;
    }
  }
  return raw || null;
}

function inferListing(text: string) {
  const raw = decodeHtml(text || '');
  const t = raw.toLowerCase();
  const email = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
  const phone = raw.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || null;
  const sentences = raw.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/);
  const about = sentences.slice(0, 2).join(' ');
  const chips: string[] = [];
  if (/\bdewormed\b/.test(t)) chips.push('Dewormed');
  if (/\bfelv\/fiv negative\b|\bfelv\b/.test(t)) chips.push('FELV/FIV negative');
  if (/\bfemale\b/.test(t)) chips.push('Female');
  if (/\bmale\b/.test(t)) chips.push('Male');
  if (/\bheartworm\b/.test(t)) chips.push('Heartworm noted');
  return {
    vaccinated: /\bvaccinat|\bup-?to-?date on (vaccines|shots)|\bshots current\b|\buptodate\b/.test(t),
    microchipped: /\bmicrochipp?ed\b/.test(t),
    spayed: /\bspayed\b|\bneutered\b|\baltered\b/.test(t),
    email,
    phone,
    about: about.length > 20 ? about : raw.slice(0, 240),
    chips,
  };
}

function publicChips(pet: PetRecord): string[] {
  const inferred = inferListing(pet.description || '');
  const out: string[] = [];
  const push = (s?: string | null) => {
    const v = String(s || '').trim();
    if (!v) return;
    if (/^vaccinated$/i.test(v)) return;
    if (out.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    out.push(v);
  };
  if (pet.dewormed || inferred.chips.includes('Dewormed')) push('Dewormed');
  if (pet.felv_fiv_negative || inferred.chips.includes('FELV/FIV negative')) push('FELV/FIV negative');
  const g = String(pet.gender || '').toLowerCase();
  if (g.startsWith('f')) push('Female');
  else if (g.startsWith('m')) push('Male');
  (pet.personality || []).forEach(push);
  inferred.chips.forEach(push);
  return out;
}

function listingRows(pet: PetRecord): [string, string][] {
  const rows: [string, string | null | undefined][] = [
    ['Size', pet.size],
    ['Coat', pet.coat],
    ['Color', pet.color],
    ['House-trained', pet.house_trained],
    ['Special needs', pet.special_needs],
    ['Adoption fee', pet.adoption_fee],
    ['Energy', pet.energy],
    ['Good with kids', pet.good_with_kids_text ?? (pet.good_with_kids ? 'Yes' : null)],
    ['Good with dogs', pet.good_with_dogs_text ?? (pet.good_with_dogs ? 'Yes' : null)],
    ['Good with cats', pet.good_with_cats_text ?? (pet.good_with_cats ? 'Yes' : null)],
  ];
  return rows.filter((r): r is [string, string] => Boolean(r[1] && String(r[1]).trim()));
}
export default function PetDetailsScreen() {
  const { id } = useLocalSearchParams();
  const safeBack = useSafeBack('/(tabs)');
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compactBar = width < 480;
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [pet, setPet] = useState<PetRecord | null>(null);
  const [shelterName, setShelterName] = useState<string>('');
  const [shelterVerified, setShelterVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [descTab, setDescTab] = useState<'about' | 'full'>('about');
  const [listingEmail, setListingEmail] = useState<string | null>(null);
  const [listingPhone, setListingPhone] = useState<string | null>(null);
  const [listingUrl, setListingUrl] = useState<string | null>(null);

  // Identity & records state
  const [microchipValue, setMicrochipValue] = useState<string | null>(null);
  const [isOrgMember, setIsOrgMember] = useState(false);
  const [isRegisteredFoster, setIsRegisteredFoster] = useState(false);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [medicalAccess, setMedicalAccess] = useState(false);
  const [adoptionHistory, setAdoptionHistory] = useState<AdoptionHistoryItem[]>([]);
  const [adoptionCount, setAdoptionCount] = useState(0);
  const [linkedReports, setLinkedReports] = useState<LinkedReport[]>([]);
  const [microchipAccessRequest, setMicrochipAccessRequest] = useState<AccessRequest | null>(null);
  const [medicalAccessRequest, setMedicalAccessRequest] = useState<AccessRequest | null>(null);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  // Application state
  const [existingApps, setExistingApps] = useState<{ foster: string | null; adopt: string | null }>({ foster: null, adopt: null });

  // Hydration safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    loadPet();
    checkFavorite();
  }, [id, user]);

  useEffect(() => {
    if (!String(id || '').startsWith('rg-a-')) return;
    const t = setInterval(() => { loadPet(); }, 45000);
    return () => clearInterval(t);
  }, [id]);

  const loadPet = async () => {
    if (!id) { setError('Pet not found'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const petId = String(id);

    if (petId.startsWith('rg-a-')) {
      try {
        const resp = await fetch('/api/rescuegroups?animal=' + encodeURIComponent(petId.replace('rg-a-', '')));
        const json = await resp.json();
        const a = json.pet;
        if (!a) {
          setError("We could not load this pet's details.");
          setLoading(false);
          return;
        }
        const inferred = inferListing(a.description || '');
        setListingEmail(a.listing_email || inferred.email);
        setListingPhone(a.listing_phone || inferred.phone);
        setListingUrl(a.listing_url || null);
        setDescTab('about');
        if (a.org_name) {
          setShelterName(a.org_name);
          setShelterVerified(true);
        }

      setPet({
          id: petId,
          name: a.name,
          breed: a.breed,
          species: a.species || 'Unknown',
          age_text: a.age_text,
          dob: a.dob || null,
          gender: a.gender,
          status: a.status || 'Available',
          availability: a.availability || 'both',
          description: decodeHtml(a.description),
          main_photo_url: a.photo_url,
          location: a.location,
          personality: inferred.chips.length ? inferred.chips : null,
          good_with_kids: false,
          good_with_dogs: false,
          good_with_cats: false,
          vaccinated: !!a.vaccinated,
          spayed_neutered: !!a.spayed_neutered,
          microchipped: !!a.microchipped,
          dewormed: !!a.dewormed,
          felv_fiv_negative: !!a.felv_fiv_negative,
          shelter_id: null,
          org_name: a.org_name || null,
          listing_phone: a.listing_phone || inferred.phone,
          listing_email: a.listing_email || inferred.email,
          size: a.size || null,
          coat: a.coat || null,
          house_trained: a.house_trained || null,
          special_needs: a.special_needs || null,
          adoption_fee: a.adoption_fee || null,
          color: a.color || null,
          energy: a.energy || null,
          good_with_kids_text: a.good_with_kids || null,
          good_with_dogs_text: a.good_with_dogs || null,
          good_with_cats_text: a.good_with_cats || null,
        });
        setLoading(false);
      } catch {
        setError("We could not load this pet's details.");
        setLoading(false);
      }
      return;
    }

    // --- Phase 1: the pet row itself must ALWAYS load ---
    const { data, error: petError } = await supabase
      .from('pets')
      .select('id, name, breed, species, age_text, gender, status, availability, description, main_photo_url, location, personality, good_with_kids, good_with_dogs, good_with_cats, vaccinated, spayed_neutered, microchipped, shelter_id')
      .eq('id', id)
      .maybeSingle();
    if (petError) {
      console.error('[pet-details] pet query failed:', petError.message);
      setError('We could not load this pet\'s details.');
      setLoading(false);
      return;
    }
    if (!data) {
      setLoading(false);
      return;
    }
    setPet({ ...data, description: decodeHtml(data.description) });
    setLoading(false);

    // --- Phase 2: gated extras — any failure must never block rendering ---
    try {
      if (data.shelter_id) {
        const { data: shelter } = await supabase
          .from('shelters')
          .select('name')
          .eq('id', data.shelter_id)
          .maybeSingle();
        if (shelter) setShelterName(shelter.name);
        const { data: org } = await supabase
          .from('organizations')
          .select('status, name, phone, contact_email')
          .eq('id', data.shelter_id)
          .maybeSingle();
        if (org && org.status === 'approved') setShelterVerified(true);
        if (org?.name && !shelterName) setShelterName(org.name);
        if (org?.phone) setListingPhone((p) => p || org.phone);
        if (org?.contact_email) setListingEmail((p) => p || org.contact_email);
      }

      // Check org membership
      let localIsMember = false;
      if (user && data.shelter_id) {
        const { data: sm } = await supabase
          .from('shelter_members')
          .select('shelter_id')
          .eq('shelter_id', data.shelter_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (sm) { localIsMember = true; setIsOrgMember(true); }

        const { data: om } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('organization_id', data.shelter_id)
          .eq('user_id', user.id)
          .maybeSingle();
        if (om) { localIsMember = true; setIsOrgMember(true); }

        // Check if registered foster
        const { data: fp } = await supabase
          .from('foster_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (fp) { setIsRegisteredFoster(true); }
      }

      // Fetch microchip via RPC — only if confirmed org member
      if (user && localIsMember) {
        const { data: mc, error: mcErr } = await supabase.rpc('get_pet_microchip', { p_pet_id: data.id });
        if (mcErr) {
          console.warn('[pet-details] get_pet_microchip failed:', mcErr.message);
        } else if (mc) {
          setMicrochipValue(mc);
        }
      }

      // Fetch medical records via RPC — only if confirmed member or has approved access
      if (user && (localIsMember || medicalAccess)) {
        const { data: medRecords, error: medErr } = await supabase.rpc('get_medical_records', { p_pet_id: data.id });
        if (medErr) {
          console.warn('[pet-details] get_medical_records failed:', medErr.message);
        } else if (medRecords) {
          setMedicalRecords(medRecords);
          setMedicalAccess(true);
        }
      }

      // Fetch adoption history via RPC — org members only
      if (user && localIsMember) {
        const { data: ah, error: ahErr } = await supabase.rpc('get_adoption_history', { p_pet_id: data.id });
        if (ahErr) {
          console.warn('[pet-details] get_adoption_history failed:', ahErr.message);
        } else if (ah) {
          setAdoptionHistory(ah);
        }
      }

      // Fetch adoption count (public)
      const { data: ac } = await supabase.rpc('get_adoption_count', { p_pet_id: data.id });
      if (ac !== null) setAdoptionCount(ac);

      // Fetch linked reports
      const { data: reports } = await supabase
        .from('reports')
        .select('id, report_type, severity, status')
        .eq('pet_id', data.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (reports) setLinkedReports(reports);

      // Fetch existing applications by this user for this pet
      if (user) {
        const { data: apps } = await supabase
          .from('foster_applications')
          .select('id, application_type, status')
          .eq('pet_id', data.id)
          .eq('applicant_id', user.id);
        if (apps) {
          const fosterApp = apps.find((a: { application_type: string; status: string; id: string }) => a.application_type === 'foster');
          const adoptApp = apps.find((a: { application_type: string; status: string; id: string }) => a.application_type === 'adopt');
          setExistingApps({
            foster: fosterApp ? fosterApp.status : null,
            adopt: adoptApp ? adoptApp.status : null,
          });
        }
      }

      // Fetch existing access requests
      if (user) {
        const { data: rars } = await supabase
          .from('record_access_requests')
          .select('id, status, scope')
          .eq('pet_id', data.id)
          .eq('requester_id', user.id);
        if (rars) {
          const mcReq = rars.find((r: AccessRequest) => r.scope === 'microchip');
          const medReq = rars.find((r: AccessRequest) => r.scope === 'medical');
          if (mcReq) setMicrochipAccessRequest(mcReq);
          if (medReq) setMedicalAccessRequest(medReq);
          if (medReq && medReq.status === 'approved') setMedicalAccess(true);
        }
      }
    } catch (err) {
      console.error('[pet-details] extras load failed:', err);
    }
  };

  const checkFavorite = useCallback(async () => {
    if (!user || !id) return;
    const { data, error: favError } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('target_type', 'pet')
      .eq('target_id', id)
      .maybeSingle();
    if (favError) return;
    if (data) { setIsFavorite(true); setFavoriteId(data.id); }
    else { setIsFavorite(false); setFavoriteId(null); }
  }, [user, id]);

  const toggleFavorite = async () => {
    if (!user || !pet) { router.push('/auth'); return; }
    if (isFavorite && favoriteId) {
      const { error: delError } = await supabase.from('favorites').delete().eq('id', favoriteId);
      if (delError) { console.error('[pet-details] favorite delete:', delError); setBanner({ message: 'Could not update favorites.', kind: 'error' }); return; }
      setIsFavorite(false); setFavoriteId(null);
    } else {
      const { data, error: insError } = await supabase
        .from('favorites').insert({ user_id: user.id, target_type: 'pet', target_id: pet.id }).select('id').single();
      if (insError) { console.error('[pet-details] favorite insert:', insError); setBanner({ message: 'Could not update favorites.', kind: 'error' }); return; }
      setIsFavorite(true); setFavoriteId(data.id);
    }
  };

  const requestMicrochipAccess = async () => {
    if (!user || !pet) return;
    try {
      const { data, error } = await supabase
        .from('record_access_requests')
        .insert({ pet_id: pet.id, requester_id: user.id, scope: 'microchip', status: 'pending' })
        .select('id, status, scope')
        .single();
      if (!error && data) setMicrochipAccessRequest(data);
    } catch { /* ignore */ }
  };

  const requestMedicalAccess = async () => {
    if (!user || !pet) return;
    try {
      const { data, error } = await supabase
        .from('record_access_requests')
        .insert({ pet_id: pet.id, requester_id: user.id, scope: 'medical', status: 'pending' })
        .select('id, status, scope')
        .single();
      if (!error && data) setMedicalAccessRequest(data);
    } catch { /* ignore */ }
  };

  if (loading || !mounted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.coral} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !pet) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || 'Pet not found'}</Text>
          <TouchableOpacity style={styles.backButton} onPress={safeBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const claimAdoptedPet = async () => {
    if (!user) { router.push('/auth'); return; }
    if (!pet) return;
    try {
      const { data, error } = await supabase.from('pets').insert({
        name: pet.name,
        breed: pet.breed,
        species: pet.species,
        age_text: pet.age_text,
        gender: pet.gender,
        description: pet.description,
        main_photo_url: pet.main_photo_url,
        location: pet.location,
        vaccinated: pet.vaccinated,
        spayed_neutered: pet.spayed_neutered,
        microchipped: pet.microchipped,
        owner_id: user.id,
        status: 'adopted',
        availability: 'none',
        is_public: false,
      }).select('id').single();
      if (error) throw error;
      try {
        await supabase.from('pet_relationships').insert({ pet_id: data.id, user_id: user.id, relationship: 'owner' });
      } catch { /* table optional */ }
      router.push(`/pet-record?petId=${data.id}`);
    } catch (err: any) {
      setBanner({ message: err?.message || 'Could not add this pet to your profile.', kind: 'error' });
    }
  };

  const openListingContact = () => {
    if (listingEmail) {
      Linking.openURL(`mailto:${listingEmail}?subject=${encodeURIComponent((pet?.name || 'Pet') + ' — inquiry')}`);
      return;
    }
    if (listingPhone) {
      Linking.openURL('tel:' + listingPhone.replace(/[^\d+]/g, ''));
      return;
    }
    if (listingUrl) {
      Linking.openURL(listingUrl);
    }
  };

  const openAppForm = (type: 'foster' | 'adopt') => {
    if (String(pet?.id || '').startsWith('rg-a-')) {
      openListingContact();
      return;
    }
    if (!user) { router.push('/auth'); return; }
    router.push(`/application?petId=${pet?.id}&type=${type}`);
  };

  const HealthTile = ({ label, done }: { label: string; done: boolean }) => (
    <View style={[styles.healthTile, done && styles.healthTileOn]}>
      {done ? (
        <Check color={Colors.teal} size={16} strokeWidth={2.6} />
      ) : (
        <Text style={styles.healthDash}>—</Text>
      )}
      <Text style={[styles.healthLabel, done && styles.healthLabelOn]} numberOfLines={2}>{label}</Text>
    </View>
  );

  const microchipFullAccess = isOrgMember;

  const chips = publicChips(pet);
  const rows = listingRows(pet);
  const phone = listingPhone || pet.listing_phone || null;
  const email = listingEmail || pet.listing_email || null;
  const heroH = Math.round(height * 0.45);
  const chipDisplay = microchipValue
    ? (microchipFullAccess ? microchipValue : `••••${String(microchipValue).slice(-4)}`)
    : 'Not on file';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
        {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroWrap, { height: heroH }]}>
          {pet.main_photo_url ? (
            pet.main_photo_url.startsWith('http') ? (
              <Image source={{ uri: pet.main_photo_url }} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <SignedImage path={pet.main_photo_url} style={styles.heroImage} />
            )
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <PawPrint color={Colors.textTertiary} size={48} />
            </View>
          )}
          <TouchableOpacity style={[styles.heroBack, { top: Math.max(12, insets.top + 8) }]} onPress={safeBack} activeOpacity={0.85}>
            <ArrowLeft color={Colors.navy} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.petInfo}>
          <View style={styles.petHeader}>
            <Text style={styles.petName} numberOfLines={2}>{titleCaseName(pet.name)}</Text>
            {compactAge(pet.age_text, pet.dob) ? <Text style={styles.petAge}>{compactAge(pet.age_text, pet.dob)}</Text> : null}
          </View>
          <Text style={styles.petBreedLocation}>
            {[pet.breed, pet.location].filter(Boolean).join(' · ')}
          </Text>

          {chips.length ? (
            <View style={styles.traitChips}>
              {chips.map((trait) => (
                <View key={trait} style={styles.traitChip}>
                  <Text style={styles.traitText}>{trait}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <SegmentedTabs
            items={[
              { key: 'about', label: 'About' },
              { key: 'full', label: 'Full listing' },
            ]}
            value={descTab}
            onChange={setDescTab}
          />

          {descTab === 'about' ? (
            <>
              {pet.description ? (
                <Text style={styles.description}>{inferListing(pet.description).about}</Text>
              ) : null}
              {phone ? (
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => Linking.openURL('tel:' + phone.replace(/[^\d+]/g, ''))}
                  activeOpacity={0.85}
                >
                  <Phone color={Colors.coral} size={18} />
                  <Text style={styles.contactBtnText} numberOfLines={1}>Call {phone}</Text>
                </TouchableOpacity>
              ) : null}
              {email ? (
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => Linking.openURL(`mailto:${email}?subject=${encodeURIComponent('Adoption inquiry: ' + pet.name)}`)}
                  activeOpacity={0.85}
                >
                  <Mail color={Colors.coral} size={18} />
                  <Text style={styles.contactBtnText} numberOfLines={1}>Email {email}</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.healthRow}>
                <HealthTile label="Vaccinated" done={pet.vaccinated} />
                <HealthTile label="Spayed/Neutered" done={pet.spayed_neutered} />
                <HealthTile label="Microchipped" done={pet.microchipped} />
              </View>

              <View style={styles.chipCard}>
                <Lock color={Colors.textTertiary} size={16} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.identityLabel}>Microchip</Text>
                    <View style={styles.accessPillRestricted}>
                      <Text style={styles.accessPillRestrictedText}>{microchipFullAccess ? 'Full access' : 'Orgs only'}</Text>
                    </View>
                  </View>
                  <Text style={microchipValue && microchipFullAccess ? styles.identityValueMono : styles.identityValueEmpty}>{chipDisplay}</Text>
                </View>
              </View>

              {shelterName ? (
                <View style={styles.shelterCard}>
                  <View style={styles.shelterAvatarTile}>
                    <Text style={styles.shelterAvatarText}>{shelterName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.shelterInfo}>
                    <View style={styles.shelterNameRow}>
                      <Text style={styles.shelterName}>{shelterName}</Text>
                      {shelterVerified ? <ShieldCheck color={Colors.teal} size={16} /> : null}
                    </View>
                    {shelterVerified ? (
                      <Text style={styles.verifiedText}>Verified 501(c)(3) · responds in ~2h</Text>
                    ) : (
                      <Text style={styles.shelterLocation}>{pet.location || ''}</Text>
                    )}
                  </View>
                </View>
              ) : null}

              <View style={styles.ctaRow}>
                <TouchableOpacity style={styles.fosterButton} onPress={() => openAppForm('foster')} activeOpacity={0.85}>
                  <Text style={styles.fosterText}>Foster</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.adoptButton} onPress={() => openAppForm('adopt')} activeOpacity={0.85}>
                  <Text style={styles.adoptText}>Adopt</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={{ gap: 10 }}>
              {rows.map(([label, value]) => (
                <View key={label} style={styles.listingRow}>
                  <Text style={styles.listingKey}>{label}</Text>
                  <Text style={styles.listingVal}>{value}</Text>
                </View>
              ))}
              {pet.description ? <Text style={styles.description}>{decodeHtml(pet.description)}</Text> : null}
            </View>
          )}
        </View>
        </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 20 },
  backButton: { backgroundColor: Colors.coral, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  backButtonText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.white },

  scrollContent: { paddingBottom: 100 },

  heroWrap: { position: 'relative', width: '100%', backgroundColor: Colors.surface },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  heroBack: {
    position: 'absolute', top: 16, left: 16,
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  heroActions: {
    position: 'absolute', top: 16, right: 16, flexDirection: 'row', gap: 8,
  },
  heroActionBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },

  petInfo: {
    backgroundColor: Colors.white,
    paddingTop: 16, paddingHorizontal: 16, paddingBottom: 24, gap: 12,
  },
  petHeader: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
  },
  petName: {
    flex: 1, fontSize: 26, fontFamily: Fonts.extrabold, fontWeight: '800', color: '#26265E',
  },
  petAge: {
    fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700', color: Colors.coral, flexShrink: 0,
  },
  petBreedLocation: {
    fontSize: 14, fontFamily: Fonts.regular, color: '#6B7280',
  },

  traitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  traitChip: {
    backgroundColor: '#F1F2F8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  traitText: {
    fontSize: 13, fontFamily: Fonts.semibold, fontWeight: '600', color: '#26265E',
  },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.coral, backgroundColor: Colors.white,
  },
  contactBtnText: {
    fontSize: 14, fontFamily: Fonts.bold, fontWeight: '700', color: Colors.coral, flexShrink: 1,
  },
  chipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: '#EEF0F4',
    padding: 14,
  },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  listingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EEF0F4' },
  listingKey: { fontSize: 13, fontFamily: Fonts.semibold, color: '#6B7280' },
  listingVal: { flex: 1, textAlign: 'right', fontSize: 14, fontFamily: Fonts.bold, color: '#26265E' },

  description: {
    fontSize: 13.5, fontFamily: Fonts.regular, color: '#4A4E69', lineHeight: 22,
  },

  healthRow: { flexDirection: 'row', gap: 10 },
  healthTile: {
    flex: 1, backgroundColor: '#F1F2F8', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', gap: 6,
  },
  healthTileOn: { backgroundColor: '#E4F3F1' },
  healthDash: {
    fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700', color: '#9AA1AC', lineHeight: 20,
  },
  healthLabel: {
    fontSize: 11, fontFamily: Fonts.semibold, color: '#6B7280', textAlign: 'center',
  },
  healthLabelOn: { color: Colors.tealDark },

  // Identity & Records card
  identityCard: {
    backgroundColor: '#FBFBFD', borderRadius: 14, borderWidth: 1, borderColor: '#EEF0F4',
    marginBottom: 8, overflow: 'hidden',
  },
  identityRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14,
  },
  identityIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  identityBody: { flex: 1, gap: 4 },
  identityLabel: {
    fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.navy,
  },
  identityValueMono: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.text, letterSpacing: 1,
  },
  identityValueEmpty: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary,
  },
  identityDivider: { height: 1, backgroundColor: '#EEF0F4' },

  // Access pills
  accessPillFull: {
    backgroundColor: Colors.tealBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  accessPillFullText: {
    fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.tealDark,
  },
  accessPillRestricted: {
    backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  accessPillRestrictedText: {
    fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.textTertiary,
  },
  accessPillPending: {
    backgroundColor: Colors.standardBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  accessPillPendingText: {
    fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.accentDark,
  },
  requestBtn: {
    borderWidth: 1.5, borderColor: Colors.coral, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  requestBtnText: {
    fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.coral,
  },

  // Medical records list
  medicalList: { gap: 8, marginTop: 4 },
  medicalEntry: {
    backgroundColor: Colors.white, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#EEF0F4',
  },
  medicalDate: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.textTertiary,
  },
  medicalTitle: {
    fontSize: 12, fontFamily: Fonts.semibold, color: Colors.navy, marginTop: 2,
  },
  medicalProvider: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 2,
  },

  // Restricted note
  restrictedNote: { gap: 6, marginTop: 4 },
  restrictedText: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 16,
  },

  // Adoption history timeline
  timeline: { gap: 10, marginTop: 4 },
  timelineItem: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  timelineBody: { flex: 1 },
  timelineEvent: {
    fontSize: 12, fontFamily: Fonts.semibold, color: Colors.navy,
  },
  timelineNote: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2,
  },

  // Linked reports
  linkedReportText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary,
  },
  caseLinkBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4,
  },
  caseLinkText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.coral,
  },
  accessLoggedNote: {
    fontSize: 10, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 2,
  },

  // Footnote
  footnoteRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 20, marginTop: 4, paddingHorizontal: 2,
  },
  footnoteText: {
    fontSize: 10.5, fontFamily: Fonts.regular, color: Colors.textTertiary, lineHeight: 15, flex: 1,
  },

  // Shelter card
  shelterCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14,
  },
  shelterAvatarTile: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.navy, justifyContent: 'center', alignItems: 'center',
  },
  shelterAvatarText: {
    fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.white,
  },
  shelterAvatarBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
  },
  shelterInfo: { flex: 1 },
  shelterNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shelterName: {
    fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text,
  },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  verifiedText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.teal,
  },
  shelterLocation: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2,
  },
  callButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
  },

  // Bottom actions — fixed footer
  bottomActions: {
    width: '100%',
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', backgroundColor: Colors.white,
    paddingHorizontal: 20, paddingTop: 12, gap: 10,
    borderTopWidth: 1, borderTopColor: '#EEF0F4',
    elevation: 8, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  bottomActionsStack: { flexDirection: 'column', gap: 8 },
  barRow: { flexDirection: 'row', gap: 8, width: '100%' },
  messageBtn: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, paddingHorizontal: 10, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  messageBtnSm: { paddingVertical: 10 },
  messageBtnText: {
    fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.navy,
  },
  messageBtnTextSm: { fontSize: 13 },
  fosterButton: {
    flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 10, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.navy, alignItems: 'center', justifyContent: 'center',
  },
  fosterText: {
    fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.navy,
  },
  adoptButton: {
    flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 10, borderRadius: 14, backgroundColor: Colors.coral, alignItems: 'center', justifyContent: 'center',
  },
  adoptText: {
    fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white,
  },
  appliedPill: {
    flex: 1, flexDirection: 'row', paddingVertical: 16, borderRadius: 14, gap: 6,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  appliedPillText: {
    fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.textSecondary,
  },
  unavailablePill: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  unavailablePillText: {
    fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.textTertiary,
  },
});
