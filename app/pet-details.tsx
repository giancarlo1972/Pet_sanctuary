import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { InlineBanner } from '@/components/InlineBanner';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '@/hooks/useSafeBack';
import {
  ArrowLeft,
  Heart,
  Share,
  MapPin,
  Shield,
  ShieldCheck,
  Phone,
  Check,
  PawPrint,
  Lock,
  Activity,
  Clock,
  TriangleAlert as AlertTriangle,
  ChevronRight,
  FileText,
  MessageCircle,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import OrgAvatar from '@/components/OrgAvatar';
import SignedImage from '@/components/SignedImage';


interface PetRecord {
  id: string;
  name: string;
  breed: string | null;
  species: string;
  age_text: string | null;
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
  shelter_id: string | null;
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
function inferListing(text: string) {
  const raw = text || '';
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
  return {
    vaccinated: /\bvaccinated\b|\bup-to-date on vaccines\b|\bshots\b/.test(t),
    microchipped: /\bmicrochipp?ed\b/.test(t),
    spayed: /\bspayed\b|\bneutered\b|\baltered\b/.test(t),
    email,
    phone,
    about: about.length > 20 ? about : raw.slice(0, 240),
    chips,
  };
}
export default function PetDetailsScreen() {
  const { id } = useLocalSearchParams();
  const safeBack = useSafeBack('/(tabs)');
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
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

  const loadPet = async () => {
    if (!id) return;
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
        setListingEmail(inferred.email);
        setListingPhone(inferred.phone);
        setDescTab('about');
        
      setPet({
          id: petId,
          name: a.name,
          breed: a.breed,
          species: a.species || 'Unknown',
          age_text: a.age_text,
          gender: a.gender,
          status: 'available',
          availability: 'adoptable',
          description: a.description,
          main_photo_url: a.photo_url,
          location: a.location,
          personality: inferred.chips.length ? inferred.chips : null,
          good_with_kids: false,
          good_with_dogs: false,
          good_with_cats: false,
          vaccinated: !!a.vaccinated || inferred.vaccinated,
          spayed_neutered: !!a.spayed_neutered || inferred.spayed,
          microchipped: !!a.microchipped || inferred.microchipped,
          shelter_id: null,
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
    setPet(data);
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
          .select('status')
          .eq('id', data.shelter_id)
          .maybeSingle();
        if (org && org.status === 'approved') setShelterVerified(true);
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

  const openAppForm = (type: 'foster' | 'adopt') => {
    if (!user) { router.push('/auth'); return; }
    router.push(`/application?petId=${pet?.id}&type=${type}`);
  };

  const HealthTile = ({ label, done }: { label: string; done: boolean }) => (
    <View style={styles.healthTile}>
      <View style={[styles.healthCheck, done && styles.healthCheckDone]}>
        {done && <Check color={Colors.white} size={14} />}
      </View>
      <Text style={styles.healthLabel} numberOfLines={2}>{label}</Text>
    </View>
  );

  // Determine microchip display state
  const microchipFullAccess = isOrgMember;
  const microchipHasRequest = microchipAccessRequest !== null;
  const microchipRequestPending = microchipAccessRequest?.status === 'pending';
  const microchipRequestApproved = microchipAccessRequest?.status === 'approved';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: 90 + insets.bottom }]}>
        {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
        {/* Hero image */}
        <View style={styles.heroWrap}>
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
          <TouchableOpacity style={styles.heroBack} onPress={safeBack}>
            <ArrowLeft color={Colors.white} size={20} />
          </TouchableOpacity>
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroActionBtn} onPress={toggleFavorite}>
              <Heart color={isFavorite ? Colors.coral : Colors.white} fill={isFavorite ? Colors.coral : 'transparent'} size={18} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroActionBtn}>
              <Share color={Colors.white} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Pet info */}
        <View style={styles.petInfo}>
          <View style={styles.petHeader}>
            <Text style={styles.petName}>{pet.name}</Text>
            {pet.age_text ? <Text style={styles.petAge}>{pet.age_text}</Text> : null}
          </View>
          <Text style={styles.petBreedLocation}>
            {pet.breed}{pet.location ? ` · ${pet.location}` : ''}
          </Text>

          {/* Trait chips */}
          {pet.personality && pet.personality.length > 0 && (
            <View style={styles.traitChips}>
              {pet.personality.map((trait, i) => (
                <View key={i} style={styles.traitChip}>
                  <Text style={styles.traitText}>{trait}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          {pet.description ? (
            <>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 }}>
                <TouchableOpacity onPress={() => setDescTab('about')} style={[styles.traitChip, descTab === 'about' && { backgroundColor: Colors.navy }]}>
                  <Text style={[styles.traitText, descTab === 'about' && { color: Colors.white }]}>About</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDescTab('full')} style={[styles.traitChip, descTab === 'full' && { backgroundColor: Colors.navy }]}>
                  <Text style={[styles.traitText, descTab === 'full' && { color: Colors.white }]}>Full listing</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.description}>
                {descTab === 'full' ? pet.description : inferListing(pet.description).about}
              </Text>
              {listingPhone ? (
                <TouchableOpacity onPress={() => Linking.openURL('tel:' + listingPhone.replace(/[^\d+]/g, ''))}>
                  <Text style={{ color: Colors.coral, fontFamily: Fonts.semibold, marginBottom: 8 }}>Call {listingPhone}</Text>
                </TouchableOpacity>
              ) : null}
              {listingEmail ? (
                <TouchableOpacity onPress={() => Linking.openURL(`mailto:${listingEmail}?subject=${encodeURIComponent('Adoption inquiry: ' + pet.name)}`)}>
                  <Text style={{ color: Colors.coral, fontFamily: Fonts.semibold, marginBottom: 8 }}>Email {listingEmail}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : null}

          {/* Health tiles */}
          <View style={styles.healthRow}>
            <HealthTile label="Vaccinated" done={pet.vaccinated} />
            <HealthTile label="Spayed/Neutered" done={pet.spayed_neutered} />
            <HealthTile label="Microchipped" done={pet.microchipped} />
          </View>

          {/* Identity & Records card */}
          <View style={styles.identityCard}>
            {/* Microchip row */}
            <View style={styles.identityRow}>
              <View style={styles.identityIcon}>
                <Lock color={Colors.navy} size={16} />
              </View>
              <View style={styles.identityBody}>
                <Text style={styles.identityLabel}>Microchip</Text>
                {microchipValue ? (
                  <Text style={styles.identityValueMono}>{microchipValue}</Text>
                ) : (
                  <Text style={styles.identityValueEmpty}>Not on file</Text>
                )}
              </View>
              {microchipFullAccess ? (
                <View style={styles.accessPillFull}>
                  <Text style={styles.accessPillFullText}>Full access</Text>
                </View>
              ) : microchipRequestApproved ? (
                <View style={styles.accessPillFull}>
                  <Text style={styles.accessPillFullText}>Approved</Text>
                </View>
              ) : microchipRequestPending ? (
                <View style={styles.accessPillPending}>
                  <Text style={styles.accessPillPendingText}>Pending review</Text>
                </View>
              ) : isRegisteredFoster ? (
                <TouchableOpacity style={styles.requestBtn} onPress={requestMicrochipAccess} activeOpacity={0.85}>
                  <Text style={styles.requestBtnText}>Request access</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.accessPillRestricted}>
                  <Text style={styles.accessPillRestrictedText}>Orgs only</Text>
                </View>
              )}
            </View>

            <View style={styles.identityDivider} />

            {/* Medical record row */}
            <View style={styles.identityRow}>
              <View style={styles.identityIcon}>
                <Activity color={Colors.navy} size={16} />
              </View>
              <View style={styles.identityBody}>
                <Text style={styles.identityLabel}>Medical record</Text>
                {medicalAccess && medicalRecords.length > 0 ? (
                  <View style={styles.medicalList}>
                    {medicalRecords.slice(0, 3).map((mr) => (
                      <View key={mr.id} style={styles.medicalEntry}>
                        <Text style={styles.medicalDate}>{mr.record_date ? formatShortDate(mr.record_date) : ''}</Text>
                        <Text style={styles.medicalTitle} numberOfLines={1}>{mr.title}</Text>
                        {mr.provider_name ? <Text style={styles.medicalProvider} numberOfLines={1}>{mr.provider_name}</Text> : null}
                      </View>
                    ))}
                  </View>
                ) : medicalAccess && medicalRecords.length === 0 ? (
                  <Text style={styles.identityValueEmpty}>No records on file</Text>
                ) : (
                  <View style={styles.restrictedNote}>
                    <View style={styles.accessPillRestricted}>
                      <Text style={styles.accessPillRestrictedText}>Restricted</Text>
                    </View>
                    <Text style={styles.restrictedText}>Summary badges above are public. Full records are restricted to verified organizations.</Text>
                    {isRegisteredFoster && !microchipHasRequest && (
                      <TouchableOpacity style={styles.requestBtn} onPress={requestMedicalAccess} activeOpacity={0.85}>
                        <Text style={styles.requestBtnText}>Request access</Text>
                      </TouchableOpacity>
                    )}
                    {medicalAccessRequest?.status === 'pending' && (
                      <View style={styles.accessPillPending}>
                        <Text style={styles.accessPillPendingText}>Pending review</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.identityDivider} />

            {/* Adoption history row */}
            <View style={styles.identityRow}>
              <View style={styles.identityIcon}>
                <Clock color={Colors.navy} size={16} />
              </View>
              <View style={styles.identityBody}>
                <Text style={styles.identityLabel}>Adoption history</Text>
                {isOrgMember && adoptionHistory.length > 0 ? (
                  <View style={styles.timeline}>
                    {adoptionHistory.map((ah) => (
                      <View key={ah.id} style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: ah.event === 'adopted' ? Colors.teal : ah.event === 'returned' ? Colors.coral : Colors.accent }]} />
                        <View style={styles.timelineBody}>
                          <Text style={styles.timelineEvent}>{ah.event === 'adopted' ? 'Adopted' : ah.event === 'returned' ? 'Returned' : 'Foster placement'}{ah.period ? ` · ${ah.period}` : ''}</Text>
                          {ah.note ? <Text style={styles.timelineNote} numberOfLines={2}>{ah.note}</Text> : null}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : isOrgMember && adoptionHistory.length === 0 ? (
                  <Text style={styles.identityValueEmpty}>No history on file</Text>
                ) : (
                  <Text style={styles.identityValueEmpty}>
                    {adoptionCount > 0 ? `${adoptionCount} previous home${adoptionCount !== 1 ? 's' : ''} · details restricted` : 'No previous homes'}
                  </Text>
                )}
              </View>
            </View>

            {linkedReports.length > 0 && <View style={styles.identityDivider} />}

            {/* Linked reports row */}
            {linkedReports.length > 0 && (
              <View style={styles.identityRow}>
                <View style={[styles.identityIcon, { backgroundColor: Colors.urgentBg }]}>
                  <AlertTriangle color={Colors.urgent} size={16} />
                </View>
                <View style={styles.identityBody}>
                  <Text style={styles.identityLabel}>Linked reports</Text>
                  <Text style={styles.linkedReportText}>
                    {linkedReports.length} linked report{linkedReports.length !== 1 ? 's' : ''} — {REPORT_TYPE_LABELS[linkedReports[0].report_type] || linkedReports[0].report_type}
                  </Text>
                  {isOrgMember && (
                    <TouchableOpacity
                      style={styles.caseLinkBtn}
                      onPress={() => router.push(`/report-details?id=${linkedReports[0].id}`)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.caseLinkText}>View case record</Text>
                      <ChevronRight color={Colors.coral} size={12} />
                    </TouchableOpacity>
                  )}
                  {isOrgMember && <Text style={styles.accessLoggedNote}>Access logged</Text>}
                </View>
              </View>
            )}
          </View>

          {/* Footnote */}
          <View style={styles.footnoteRow}>
            <Shield color={Colors.textTertiary} size={11} />
            <Text style={styles.footnoteText}>
              Medical and adoption records may contain PII/ePHI. Access is role-based, approved by the listing organization, and every view is logged.
            </Text>
          </View>

          {/* Shelter card */}
          {shelterName ? (
            <View style={styles.shelterCard}>
              <View style={styles.shelterAvatarTile}>
                <Text style={styles.shelterAvatarText}>{shelterName.charAt(0).toUpperCase()}</Text>
                {shelterVerified && (
                  <View style={styles.shelterAvatarBadge}>
                    <ShieldCheck color={Colors.teal} size={10} />
                  </View>
                )}
              </View>
              <View style={styles.shelterInfo}>
                <View style={styles.shelterNameRow}>
                  <Text style={styles.shelterName}>{shelterName}</Text>
                  {shelterVerified && <ShieldCheck color={Colors.teal} size={14} />}
                </View>
                {shelterVerified ? (
                  <Text style={styles.verifiedText}>Verified 501(c)(3) · responds in ~2h</Text>
                ) : (
                  <Text style={styles.shelterLocation}>{pet.location || ''}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.callButton}
                onPress={async () => {
                  if (!user) { router.push('/auth'); return; }
                  if (!pet) return;
                  try {
                    const { data, error } = await supabase.rpc('get_or_create_conversation', {
                      p_subject_type: 'pet',
                      p_subject_id: pet.id,
                    });
                    if (error) throw error;
                    router.push(`/chat?conversationId=${data}` as any);
                  } catch (err) { console.error('[pet-details] conversation failed:', err); }
                }}
                activeOpacity={0.85}
              >
                <MessageCircle color={Colors.coral} size={18} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom actions — fixed footer with top border */}
      <View style={[styles.bottomActions, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={() => {
            if (String(pet.id).startsWith('rg-a-')) {
              if (listingEmail) {
                Linking.openURL(`mailto:${listingEmail}?subject=${encodeURIComponent('Adoption inquiry: ' + pet.name)}`);
              } else if (listingPhone) {
                Linking.openURL('tel:' + listingPhone.replace(/[^\d+]/g, ''));
              }
              return;
            }
            if (!user) { router.push('/auth'); return; }
            (async () => {
              try {
                const { data, error } = await supabase.rpc('get_or_create_conversation', {
                  p_subject_type: 'pet',
                  p_subject_id: pet.id,
                });
                if (error) throw error;
                router.push(`/chat?conversationId=${data}` as any);
              } catch (err) { console.error('[pet-details] conversation failed:', err); }
            })();
          }}
          activeOpacity={0.85}
        >
          <MessageCircle color={Colors.navy} size={18} />
          <Text style={styles.messageBtnText}>Message</Text>
        </TouchableOpacity>
        {(pet.availability === 'foster' || pet.availability === 'both') && (
          existingApps.foster ? (
            <View style={styles.appliedPill}>
              <FileText color={Colors.textTertiary} size={14} />
              <Text style={styles.appliedPillText}>Application {existingApps.foster}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.fosterButton} onPress={() => openAppForm('foster')}>
              <Text style={styles.fosterText}>Foster me</Text>
            </TouchableOpacity>
          )
        )}
        {(pet.availability === 'adoption' || pet.availability === 'both') && (
          existingApps.adopt ? (
            <View style={styles.appliedPill}>
              <FileText color={Colors.textTertiary} size={14} />
              <Text style={styles.appliedPillText}>Application {existingApps.adopt}</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.adoptButton} onPress={() => openAppForm('adopt')}>
              <Text style={styles.adoptText}>Adopt {pet.name}</Text>
            </TouchableOpacity>
          )
        )}
        {pet.availability === 'none' && (
          <View style={styles.unavailablePill}>
            <Text style={styles.unavailablePillText}>Not available for foster or adoption</Text>
          </View>
        )}
      </View>
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

  heroWrap: { position: 'relative', width: '100%', height: 360, backgroundColor: Colors.navy },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  heroBack: {
    position: 'absolute', top: 16, left: 16,
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  heroActions: {
    position: 'absolute', top: 16, right: 16, flexDirection: 'row', gap: 8,
  },
  heroActionBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },

  petInfo: {
    backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -24, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 20,
  },
  petHeader: {
    flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4,
  },
  petName: {
    fontSize: FontSizes['3xl'], fontFamily: Fonts.extrabold, color: Colors.text,
  },
  petAge: {
    fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.coral,
  },
  petBreedLocation: {
    fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: 16,
  },

  traitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  traitChip: {
    backgroundColor: '#F1F2F8', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  traitText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.navy,
  },

  description: {
    fontSize: 13.5, fontFamily: Fonts.regular, color: '#4A4E69', lineHeight: 22, marginBottom: 20,
  },

  healthRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  healthTile: {
    flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 14, alignItems: 'center', gap: 8,
  },
  healthCheck: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  healthCheckDone: { backgroundColor: Colors.teal },
  healthLabel: {
    fontSize: 11, fontFamily: Fonts.semibold, color: Colors.text, textAlign: 'center',
  },

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
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', backgroundColor: Colors.white,
    paddingHorizontal: 20, paddingTop: 16, gap: 12,
    borderTopWidth: 1, borderTopColor: '#EEF0F4',
    elevation: 8, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  messageBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  messageBtnText: {
    fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.navy,
  },
  fosterButton: {
    flex: 1, paddingVertical: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.navy, alignItems: 'center',
  },
  fosterText: {
    fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.navy,
  },
  adoptButton: {
    flex: 1, paddingVertical: 16, borderRadius: 14, backgroundColor: Colors.coral, alignItems: 'center',
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
