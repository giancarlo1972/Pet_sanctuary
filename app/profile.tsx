import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Switch,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin, Shield, ShieldCheck, LogOut, ChevronRight,
  EyeOff, Heart, TriangleAlert as AlertTriangle,
  FileText, Settings, Phone, IdCard, GraduationCap,
  Award, PawPrint, Home, Clock, Check, X, Plus, MessageCircle, Pencil,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { router, useFocusEffect } from 'expo-router';
import { useSafeBack } from '@/hooks/useSafeBack';
import { useAuth } from '@/lib/context/AuthContext';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/AppHeader';
import AuthForm from '@/components/AuthForm';
import SignedImage from '@/components/SignedImage';

const DEFAULT_SCREEN_WIDTH = 375;
const DRAWER_WIDTH = DEFAULT_SCREEN_WIDTH * 0.86;

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  location: string | null;
  avatar_url: string | null;
  role: string | null;
  address_city: string | null;
  address_state: string | null;
};

type Verifications = {
  id_verified: boolean;
  phone_verified: boolean;
  responder_training: string;
};

type ModItem = {
  id: string;
  subject_type: string;
  subject_id: string;
  flag_reason: string | null;
  status: string;
};

function formatShortDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function ProfileScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || authLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.coral} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.topNav}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
            <Text style={styles.topNavLink}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(tabs)/pets')} activeOpacity={0.75}>
            <Text style={styles.topNavLink}>Browse Pets</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/about')} activeOpacity={0.75}>
            <Text style={styles.topNavLink}>About</Text>
          </TouchableOpacity>
          <Text style={[styles.topNavLink, styles.topNavLinkActive]}>Sign In</Text>
        </View>
        <ScrollView contentContainerStyle={styles.authScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.authHeader}>
            <Text style={styles.authTitle}>Welcome Back</Text>
            <Text style={styles.authSubtitle}>Sign in to view your profile and activity.</Text>
          </View>
          <AuthForm variant="plain" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return <ProfileDrawer userId={user.id} email={user.email ?? ''} signOut={signOut} />;
}

function ProfileDrawer({ userId, email, signOut }: { userId: string; email: string; signOut: () => Promise<void> }) {
  const safeBack = useSafeBack('/(tabs)');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [verifications, setVerifications] = useState<Verifications>({ id_verified: false, phone_verified: false, responder_training: 'none' });
  const [modItems, setModItems] = useState<ModItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [approxLocation, setApproxLocation] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(DRAWER_WIDTH);
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const scrimAnim = useRef(new Animated.Value(0)).current;

  // Applications
  interface MyApp { id: string; pet_id: string; pet_name: string; application_type: string; status: string; created_at: string; submitted_at: string | null; decided_at: string | null; }
  interface ReceivedApp {
    id: string; pet_name: string; application_type: string; status: string; created_at: string;
    applicant_name: string; applicant_email: string; applicant_phone: string;
    message: string | null; home_type: string | null; has_other_pets: boolean;
    experience: string | null; answers: Record<string, any> | null;
    reviewer_notes: string | null; housing_type: string | null; owns_home: boolean;
    pets_allowed: boolean; adults_count: number | null; children_ages: string | null; hours_alone: number | null;
    has_fenced_yard: boolean; vet_clinic_name: string | null; vet_phone: string | null;
    home_visit_consent: boolean; attestation_signed_name: string | null;
  }
  const [myApps, setMyApps] = useState<MyApp[]>([]);
  const [receivedApps, setReceivedApps] = useState<ReceivedApp[]>([]);
  const [reviewingApp, setReviewingApp] = useState<ReceivedApp | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  // My Pets (pet_relationships)
  interface PetRel { id: string; pet_id: string; pet_name: string; pet_photo: string | null; species: string | null; breed: string | null; relationship: string; started_on: string | null; ended_on: string | null; }
  const [activePets, setActivePets] = useState<PetRel[]>([]);
  const [pastPets, setPastPets] = useState<PetRel[]>([]);
  const [showPastPets, setShowPastPets] = useState(false);

  // Due Soon reminders
  interface PetReminder { pet_id: string; pet_name: string; pet_photo: string | null; label: string; days_until_due: number; urgency: string; }
  const [reminders, setReminders] = useState<PetReminder[]>([]);

  // Foster Ratings
  interface FosterRating { id: string; rating: number; comment: string | null; foster_response: string | null; created_at: string; rater_org_name: string | null; pet_name: string | null; }
  const [fosterSummary, setFosterSummary] = useState<{ avg_rating: number | null; rating_count: number } | null>(null);
  const [fosterRatings, setFosterRatings] = useState<FosterRating[]>([]);
  const [ratingModalId, setRatingModalId] = useState<string | null>(null);
  const [ratingResponse, setRatingResponse] = useState('');
  const [rateFosterModalPet, setRateFosterModalPet] = useState<string | null>(null);
  const [rateFosterForm, setRateFosterForm] = useState({ rating: 5, comment: '' });
  const [savingRating, setSavingRating] = useState(false);

  // Services I Provide
  interface ServiceOffer { id: string; service_type: string; details: string | null; radius_km: number | null; active: boolean; }
  const [services, setServices] = useState<ServiceOffer[]>([]);
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<ServiceOffer | null>(null);
  const [serviceForm, setServiceForm] = useState({ service_type: '', details: '', radius_km: '', active: true });
  const [savingService, setSavingService] = useState(false);

  // My Contributions
  interface Contribution { id: string; contribution_type: string; org_name: string | null; amount_cents: number | null; quantity: string | null; description: string | null; occurred_on: string | null; verified_at: string | null; verified_by_org: string | null; }
  const [contributions, setContributions] = useState<Contribution[]>([]);

  // Applicant Profile (reusable application info)
  interface ApplicantProfile {
    full_name: string | null; email: string | null; phone: string | null;
    address_line: string | null; city: string | null; state: string | null; postal_code: string | null;
    is_adult: boolean | null; housing_type: string | null; owns_home: boolean | null;
    landlord_name: string | null; landlord_phone: string | null; pets_allowed: boolean | null;
    adults_count: number | null; children_ages: string | null; has_fenced_yard: boolean | null;
    hours_alone: number | null; vet_clinic_name: string | null; vet_phone: string | null;
    experience: string | null;
  }
  const [applicantProfile, setApplicantProfile] = useState<ApplicantProfile | null>(null);
  const [editingAppProfile, setEditingAppProfile] = useState(false);

  useEffect(() => {
    const realWidth = Dimensions.get('window').width;
    setDrawerWidth(realWidth * 0.86);
  }, []);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(scrimAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, scrimAnim]);

  const closeDrawer = useCallback(() => {
    router.replace('/(tabs)');
  }, []);

  useEffect(() => { openDrawer(); }, [openDrawer]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: row, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, location, avatar_url, role, address_city, address_state')
        .eq('id', userId)
        .maybeSingle();
      if (error) { setLoadError('We could not load your profile.'); setLoading(false); return; }
      let profileRow = row;
      if (!row) {
        const { data: userData } = await supabase.auth.getUser();
        const metaName = (userData.user?.user_metadata?.full_name as string | undefined) || (userData.user?.user_metadata?.name as string | undefined) || null;
        const { data: inserted } = await supabase
          .from('profiles')
          .insert({ id: userId, email, full_name: metaName })
          .select('id, full_name, email, location, avatar_url, role, address_city, address_state')
          .maybeSingle();
        profileRow = inserted;
      }
      setProfile(profileRow);

      const { data: verifRow } = await supabase
        .from('user_verifications')
        .select('id_verified, phone_verified, responder_training')
        .eq('user_id', userId)
        .maybeSingle();
      if (verifRow) setVerifications(verifRow);

      const { data: modData } = await supabase
        .from('moderation_queue')
        .select('id, subject_type, subject_id, flag_reason, status')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
      if (modData) setModItems(modData);

      // Load user's applications from my_applications VIEW (status only, never reviewer notes)
      const { data: myAppsData } = await supabase
        .from('my_applications')
        .select('id, application_type, status, created_at, submitted_at, decided_at, pet_id')
        .order('created_at', { ascending: false });
      if (myAppsData) {
        const petIds = [...new Set(myAppsData.map((a: any) => a.pet_id))];
        const { data: petsData } = await supabase
          .from('pets')
          .select('id, name')
          .in('id', petIds);
        const petMap: Record<string, string> = {};
        petsData?.forEach((p: any) => { petMap[p.id] = p.name; });
        setMyApps(myAppsData.map((a: any) => ({
          id: a.id,
          pet_id: a.pet_id,
          pet_name: petMap[a.pet_id] || 'Unknown',
          application_type: a.application_type,
          status: a.status,
          created_at: a.created_at,
          submitted_at: a.submitted_at,
          decided_at: a.decided_at,
        })));
      }

      // Load received applications if shelter member — full data including answers & reviewer_notes
      if (profileRow?.role === 'shelter' || profileRow?.role === 'admin') {
        const { data: shelterPets } = await supabase
          .from('pets')
          .select('id, name')
          .eq('shelter_id', userId);
        if (shelterPets && shelterPets.length > 0) {
          const petIds = shelterPets.map((p: { id: string }) => p.id);
          const petNameMap: Record<string, string> = {};
          shelterPets.forEach((p: any) => { petNameMap[p.id] = p.name; });
          const { data: receivedData } = await supabase
            .from('foster_applications')
            .select('id, application_type, status, created_at, pet_id, applicant_name, applicant_email, applicant_phone, message, home_type, has_other_pets, experience, answers, reviewer_notes, housing_type, owns_home, pets_allowed, adults_count, children_ages, hours_alone, has_fenced_yard, vet_clinic_name, vet_phone, home_visit_consent, attestation_signed_name')
            .in('pet_id', petIds)
            .order('created_at', { ascending: false });
          if (receivedData) {
            setReceivedApps(receivedData.map((a: any) => ({
              id: a.id,
              pet_name: petNameMap[a.pet_id] || 'Unknown',
              application_type: a.application_type,
              status: a.status,
              created_at: a.created_at,
              applicant_name: a.applicant_name || 'Anonymous',
              applicant_email: a.applicant_email || '',
              applicant_phone: a.applicant_phone || '',
              message: a.message,
              home_type: a.home_type,
              has_other_pets: a.has_other_pets,
              experience: a.experience,
              answers: a.answers,
              reviewer_notes: a.reviewer_notes,
              housing_type: a.housing_type,
              owns_home: a.owns_home,
              pets_allowed: a.pets_allowed,
              adults_count: a.adults_count,
              children_ages: a.children_ages,
              hours_alone: a.hours_alone,
              has_fenced_yard: a.has_fenced_yard,
              vet_clinic_name: a.vet_clinic_name,
              vet_phone: a.vet_phone,
              home_visit_consent: a.home_visit_consent,
              attestation_signed_name: a.attestation_signed_name,
            })));
          }
        }
      }
      // === My Pets (pet_relationships) ===
      const { data: relsData } = await supabase
        .from('pet_relationships')
        .select('id, pet_id, relationship, started_on, ended_on')
        .eq('user_id', userId)
        .order('started_on', { ascending: false });
      if (relsData) {
        const petIds = [...new Set(relsData.map((r) => r.pet_id))];
        const { data: relPets } = await supabase
          .from('pets')
          .select('id, name, species, breed, main_photo_url')
          .in('id', petIds);
        const petMap: Record<string, { name: string; species: string | null; breed: string | null; photo: string | null }> = {};
        relPets?.forEach((p) => { petMap[p.id] = { name: p.name || 'Unknown', species: p.species, breed: p.breed, photo: p.main_photo_url }; });
        const mapped: PetRel[] = relsData.map((r) => ({
          id: r.id, pet_id: r.pet_id, pet_name: petMap[r.pet_id]?.name || 'Unknown',
          pet_photo: petMap[r.pet_id]?.photo || null, species: petMap[r.pet_id]?.species || null,
          breed: petMap[r.pet_id]?.breed || null, relationship: r.relationship,
          started_on: r.started_on, ended_on: r.ended_on,
        }));
        setActivePets(mapped.filter((r) => !r.ended_on));
        setPastPets(mapped.filter((r) => r.ended_on));
      }

      // === Due Soon reminders (my_pet_reminders view) ===
      const { data: reminderData } = await supabase
        .from('my_pet_reminders')
        .select('pet_id, pet_name, pet_photo, label, days_until_due, urgency')
        .in('urgency', ['overdue', 'due_soon'])
        .order('days_until_due', { ascending: true });
      if (reminderData) setReminders(reminderData as PetReminder[]);

      // === Foster Ratings ===
      const { data: frSummary } = await supabase
        .from('foster_rating_summary')
        .select('avg_rating, rating_count')
        .eq('foster_user_id', userId)
        .maybeSingle();
      setFosterSummary(frSummary as any);

      const { data: frData } = await supabase
        .from('foster_ratings')
        .select('id, rating, comment, foster_response, created_at, organization_id, pet_id')
        .eq('foster_user_id', userId)
        .order('created_at', { ascending: false });
      if (frData) {
        const orgIds = [...new Set(frData.map((r) => r.organization_id).filter(Boolean))] as string[];
        const petIds2 = [...new Set(frData.map((r) => r.pet_id).filter(Boolean))] as string[];
        const [orgRes, petRes] = await Promise.all([
          orgIds.length ? supabase.from('organizations').select('id, name').in('id', orgIds) : Promise.resolve({ data: [] }),
          petIds2.length ? supabase.from('pets').select('id, name').in('id', petIds2) : Promise.resolve({ data: [] }),
        ]);
        const orgMap: Record<string, string> = {};
        (orgRes.data as any[])?.forEach((o) => { orgMap[o.id] = o.name; });
        const petNameMap: Record<string, string> = {};
        (petRes.data as any[])?.forEach((p) => { petNameMap[p.id] = p.name; });
        setFosterRatings(frData.map((r) => ({
          id: r.id, rating: r.rating, comment: r.comment, foster_response: r.foster_response,
          created_at: r.created_at, rater_org_name: r.organization_id ? orgMap[r.organization_id] || null : null,
          pet_name: r.pet_id ? petNameMap[r.pet_id] || null : null,
        })));
      }

      // === Services I Provide ===
      const { data: svcData } = await supabase
        .from('service_offers')
        .select('id, service_type, details, radius_km, active')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setServices((svcData as ServiceOffer[]) || []);

      // === My Contributions ===
      const { data: contribData } = await supabase
        .from('contributions')
        .select('id, contribution_type, organization_id, amount_cents, quantity, description, occurred_on, verified_at, verified_by')
        .eq('user_id', userId)
        .order('occurred_on', { ascending: false });
      if (contribData) {
        const orgIds3 = [...new Set(contribData.map((c) => c.organization_id).filter(Boolean))] as string[];
        const verIds = [...new Set(contribData.map((c) => c.verified_by).filter(Boolean))] as string[];
        const [orgRes3, verRes] = await Promise.all([
          orgIds3.length ? supabase.from('organizations').select('id, name').in('id', orgIds3) : Promise.resolve({ data: [] }),
          verIds.length ? supabase.from('organizations').select('id, name').in('id', verIds) : Promise.resolve({ data: [] }),
        ]);
        const orgMap3: Record<string, string> = {};
        (orgRes3.data as any[])?.forEach((o) => { orgMap3[o.id] = o.name; });
        const verOrgMap: Record<string, string> = {};
        (verRes.data as any[])?.forEach((o) => { verOrgMap[o.id] = o.name; });
        setContributions(contribData.map((c) => ({
          id: c.id, contribution_type: c.contribution_type, org_name: c.organization_id ? orgMap3[c.organization_id] || null : null,
          amount_cents: c.amount_cents, quantity: c.quantity, description: c.description, occurred_on: c.occurred_on,
          verified_at: c.verified_at, verified_by_org: c.verified_by ? verOrgMap[c.verified_by] || null : null,
        })));
      }

    } catch {
      setLoadError('We could not load your profile.');
    }

    // Load applicant profile (reusable application info)
    try {
      const { data: apProfile } = await supabase
        .from('applicant_profiles')
        .select('full_name, email, phone, address_line, city, state, postal_code, is_adult, housing_type, owns_home, landlord_name, landlord_phone, pets_allowed, adults_count, children_ages, has_fenced_yard, hours_alone, vet_clinic_name, vet_phone, experience')
        .eq('user_id', userId)
        .maybeSingle();
      if (apProfile) setApplicantProfile(apProfile as ApplicantProfile);
    } catch { /* non-critical */ }

    setLoading(false);
  }, [userId, email]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleLogout = async () => { await signOut(); };

  const handleModAction = async (item: ModItem, action: 'approved' | 'rejected') => {
    setModItems((prev) => prev.map((m) => m.id === item.id ? { ...m, status: action } : m));
    try {
      await supabase
        .from('moderation_queue')
        .update({ status: action, reviewer_id: userId, resolved_at: new Date().toISOString() })
        .eq('id', item.id);
    } catch {
      setModItems((prev) => prev.map((m) => m.id === item.id ? { ...m, status: 'pending' } : m));
    }
  };

  const handleWithdraw = async (appId: string) => {
    setMyApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'withdrawn' } : a));
    try {
      await supabase.from('foster_applications').update({ status: 'withdrawn' }).eq('id', appId);
    } catch {
      setMyApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'pending' } : a));
    }
  };

  const handleAppDecision = async (appId: string, decision: 'approved' | 'declined') => {
    const notes = reviewNotes.trim() || null;
    setReceivedApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: decision } : a));
    setReviewModalVisible(false);
    setReviewingApp(null);
    setReviewNotes('');
    try {
      const { error: rpcErr } = await supabase.rpc('decide_foster_application', {
        p_application_id: appId,
        p_decision: decision,
        p_notes: notes,
      });
      if (rpcErr) console.warn('[profile] decide_foster_application failed:', rpcErr.message);
    } catch {
      setReceivedApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'pending' } : a));
    }
  };

  const saveFosterResponse = async (ratingId: string) => {
    if (!ratingResponse.trim()) return;
    const { error } = await supabase
      .from('foster_ratings')
      .update({ foster_response: ratingResponse.trim() })
      .eq('id', ratingId);
    if (!error) {
      setFosterRatings((prev) => prev.map((r) => r.id === ratingId ? { ...r, foster_response: ratingResponse.trim() } : r));
      setRatingModalId(null);
      setRatingResponse('');
    }
  };

  const openServiceModal = (svc: ServiceOffer | null) => {
    setEditingService(svc);
    if (svc) {
      setServiceForm({ service_type: svc.service_type, details: svc.details || '', radius_km: svc.radius_km?.toString() || '', active: svc.active });
    } else {
      setServiceForm({ service_type: '', details: '', radius_km: '', active: true });
    }
    setServiceModalVisible(true);
  };

  const saveService = async () => {
    if (!serviceForm.service_type.trim()) return;
    setSavingService(true);
    const payload = {
      user_id: userId,
      service_type: serviceForm.service_type.trim(),
      details: serviceForm.details.trim() || null,
      radius_km: serviceForm.radius_km ? parseInt(serviceForm.radius_km, 10) || null : null,
      active: serviceForm.active,
    };
    if (editingService) {
      const { error } = await supabase.from('service_offers').update(payload).eq('id', editingService.id);
      if (!error) setServices((prev) => prev.map((s) => s.id === editingService.id ? { ...s, ...payload } : s));
    } else {
      const { data, error } = await supabase.from('service_offers').insert(payload).select('id, service_type, details, radius_km, active').maybeSingle();
      if (data) setServices((prev) => [data as ServiceOffer, ...prev]);
    }
    setSavingService(false);
    setServiceModalVisible(false);
  };

  const deleteService = async (id: string) => {
    await supabase.from('service_offers').delete().eq('id', id);
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  // Contribution totals
  const contribCounts: Record<string, number> = {};
  let fosterDays = 0;
  contributions.forEach((c) => {
    const type = c.contribution_type;
    if (type === 'foster_days') {
      const n = parseInt(c.quantity || '0', 10);
      if (!Number.isNaN(n)) fosterDays += n;
    } else {
      contribCounts[type] = (contribCounts[type] || 0) + 1;
    }
  });
  const contribTotals = Object.entries(contribCounts).map(([type, count]) => `${count} ${type.replace(/_/g, ' ')}`);
  if (fosterDays > 0) contribTotals.push(`${fosterDays} foster days`);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.coral} />
      </SafeAreaView>
    );
  }

  if ((loadError || !profile) && !loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.notFoundTitle}>Couldn't load profile</Text>
        <Text style={styles.notFoundSub}>{loadError || 'No profile data was found for your account.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load} activeOpacity={0.85}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const displayName = profile?.full_name?.trim() || 'Rescue Army Member';
  const displayEmail = profile?.email || email;
  const initial = displayName.charAt(0).toUpperCase();
  const cityState = [profile?.address_city, profile?.address_state].map((p) => p?.trim()).filter(Boolean).join(', ');
  const isVerified = verifications.id_verified && verifications.phone_verified;
  const isOrgAdmin = profile?.role === 'admin' || profile?.role === 'shelter';

  const trainingPill = verifications.responder_training === 'passed'
    ? { bg: Colors.tealBg, color: Colors.tealDark, text: 'Passed' }
    : verifications.responder_training === 'in_review'
    ? { bg: Colors.standardBg, color: Colors.accentDark, text: 'In review' }
    : { bg: Colors.surface, color: Colors.textTertiary, text: 'Not started' };

  return (
    <>
      {/* Scrim */}
      {drawerOpen && (
        <Animated.View style={[styles.scrim, { opacity: scrimAnim }]} pointerEvents="auto">
          <TouchableOpacity style={styles.scrimTouchable} activeOpacity={1} onPress={closeDrawer} />
        </Animated.View>
      )}

      {/* Drawer */}
      <Animated.View style={[styles.drawer, { width: drawerWidth, transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.drawerInner}>
          {/* Header */}
          <View style={styles.drawerHeader}>
            <TouchableOpacity style={styles.closeButton} onPress={closeDrawer}>
              <X color={Colors.text} size={22} />
            </TouchableOpacity>
            <Text style={styles.drawerTitle}>Me</Text>
            <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/inbox' as any)}>
              <MessageCircle color={Colors.coral} size={20} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/edit-profile')}>
              <Settings color={Colors.coral} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.drawerScroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.drawerContent}>
            {loadError && (
              <View style={styles.errorBox}><Text style={styles.errorText}>{loadError}</Text></View>
            )}

            {/* Avatar + name */}
            <View style={styles.profileSection}>
              <View style={styles.avatarWrap}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>{initial}</Text>
                  </View>
                )}
              </View>
              <View style={styles.profileDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName}>{displayName}</Text>
                  {isVerified && <ShieldCheck color={Colors.teal} size={16} />}
                </View>
                <Text style={styles.userSubtitle}>
                  {isVerified ? 'Verified rescuer' : 'Rescue Army member'}{cityState ? ` · ${cityState}` : ''}
                </Text>
              </View>
            </View>

            {/* Trust & Verification */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trust & Verification</Text>
              <View style={styles.card}>
                <VerificationRow
                  icon={<IdCard color={Colors.navy} size={18} />}
                  label="Government ID"
                  pill={verifications.id_verified ? { bg: Colors.tealBg, color: Colors.tealDark, text: 'Verified' } : { bg: Colors.surface, color: Colors.textTertiary, text: 'Pending' }}
                />
                <View style={styles.divider} />
                <VerificationRow
                  icon={<Phone color={Colors.navy} size={18} />}
                  label="Phone"
                  pill={verifications.phone_verified ? { bg: Colors.tealBg, color: Colors.tealDark, text: 'Verified' } : { bg: Colors.surface, color: Colors.textTertiary, text: 'Pending' }}
                />
                <View style={styles.divider} />
                <VerificationRow
                  icon={<GraduationCap color={Colors.navy} size={18} />}
                  label="Responder training"
                  pill={trainingPill}
                />
              </View>
            </View>

            {/* Privacy */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Privacy</Text>
              <View style={styles.card}>
                <View style={styles.privacyRow}>
                  <View style={styles.privacyLeft}>
                    <EyeOff color={Colors.navy} size={18} />
                    <View>
                      <Text style={styles.privacyLabel}>Approximate location</Text>
                      <Text style={styles.privacyDesc}>Show ~300m radius instead of exact pin</Text>
                    </View>
                  </View>
                  <Switch
                    value={approxLocation}
                    onValueChange={setApproxLocation}
                    trackColor={{ false: Colors.borderInput, true: Colors.teal }}
                    thumbColor={Colors.white}
                  />
                </View>
              </View>
            </View>

            {/* My Badges */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Badges</Text>
              <View style={styles.badgeRow}>
                <BadgeChip icon={<AlertTriangle color={Colors.coral} size={14} />} label="First responder" />
                <BadgeChip icon={<PawPrint color={Colors.teal} size={14} />} label="12 rescues assisted" />
                <BadgeChip icon={<Home color={Colors.navy} size={14} />} label="Foster ready" />
              </View>
            </View>

            {/* Moderation Queue (org-admin only) */}
            {isOrgAdmin && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Moderation Queue</Text>
                {modItems.length === 0 ? (
                  <View style={styles.card}>
                    <Text style={styles.emptyText}>No items pending review</Text>
                  </View>
                ) : (
                  modItems.map((item) => (
                    <View key={item.id} style={styles.modCard}>
                      <View style={styles.modHeader}>
                        <View style={styles.modIcon}>
                          <AlertTriangle color={Colors.urgent} size={16} />
                        </View>
                        <View style={styles.modInfo}>
                          <Text style={styles.modType}>{item.subject_type}</Text>
                          <Text style={styles.modReason} numberOfLines={2}>{item.flag_reason || 'Flagged for review'}</Text>
                        </View>
                      </View>
                      {item.status === 'pending' ? (
                        <View style={styles.modActions}>
                          <TouchableOpacity style={styles.modApproveBtn} onPress={() => handleModAction(item, 'approved')} activeOpacity={0.85}>
                            <Check color={Colors.tealDark} size={14} />
                            <Text style={styles.modApproveText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.modRejectBtn} onPress={() => handleModAction(item, 'rejected')} activeOpacity={0.85}>
                            <X color={Colors.critical} size={14} />
                            <Text style={styles.modRejectText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.modResolved}>
                          <Check color={item.status === 'approved' ? Colors.teal : Colors.critical} size={14} />
                          <Text style={[styles.modResolvedText, { color: item.status === 'approved' ? Colors.tealDark : Colors.critical }]}>
                            {item.status === 'approved' ? 'Approved' : 'Rejected'}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Application Info */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Application Info</Text>
                {applicantProfile && !editingAppProfile && (
                  <TouchableOpacity style={styles.addBtn} onPress={() => setEditingAppProfile(true)} activeOpacity={0.85}>
                    <Pencil color={Colors.coral} size={12} />
                    <Text style={styles.addBtnText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
              {applicantProfile ? (
                <View style={styles.card}>
                  <Text style={styles.appProfileNote}>
                    This prefills future applications and doesn't alter submitted ones.
                  </Text>
                  <Text style={styles.appProfileRow}><Text style={styles.appProfileLabel}>Name: </Text>{applicantProfile.full_name || '—'}</Text>
                  <Text style={styles.appProfileRow}><Text style={styles.appProfileLabel}>Email: </Text>{applicantProfile.email || '—'}</Text>
                  <Text style={styles.appProfileRow}><Text style={styles.appProfileLabel}>Phone: </Text>{applicantProfile.phone || '—'}</Text>
                  <Text style={styles.appProfileRow}><Text style={styles.appProfileLabel}>Address: </Text>{[applicantProfile.address_line, applicantProfile.city, applicantProfile.state].filter(Boolean).join(', ') || '—'}</Text>
                  <Text style={styles.appProfileRow}><Text style={styles.appProfileLabel}>Housing: </Text>{applicantProfile.housing_type || '—'} · {applicantProfile.owns_home ? 'Owns' : 'Rents'}</Text>
                  <Text style={styles.appProfileRow}><Text style={styles.appProfileLabel}>Fenced yard: </Text>{applicantProfile.has_fenced_yard ? 'Yes' : 'No'}</Text>
                  <Text style={styles.appProfileRow}><Text style={styles.appProfileLabel}>Hours alone/day: </Text>{applicantProfile.hours_alone?.toString() || '—'}</Text>
                  {applicantProfile.vet_clinic_name ? <Text style={styles.appProfileRow}><Text style={styles.appProfileLabel}>Vet: </Text>{applicantProfile.vet_clinic_name}</Text> : null}
                  {applicantProfile.experience ? <Text style={styles.appProfileRow}><Text style={styles.appProfileLabel}>Experience: </Text>{applicantProfile.experience}</Text> : null}
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>No saved application info yet. It's filled automatically when you submit your first application.</Text>
                </View>
              )}
            </View>

            {/* My Applications */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Applications</Text>
              {myApps.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>No applications yet</Text>
                </View>
              ) : (
                myApps.map((app) => (
                  <View key={app.id} style={styles.modCard}>
                    <View style={styles.modHeader}>
                      <View style={styles.modIcon}>
                        <PawPrint color={Colors.navy} size={16} />
                      </View>
                      <View style={styles.modInfo}>
                        <Text style={styles.modType}>{app.pet_name}</Text>
                        <Text style={styles.modReason}>{app.application_type === 'foster' ? 'Foster' : 'Adoption'} · {formatShortDate(app.created_at)}</Text>
                      </View>
                    </View>
                    {app.status === 'pending' || app.status === 'submitted' ? (
                      <View style={styles.modActions}>
                        <TouchableOpacity style={styles.modRejectBtn} onPress={() => handleWithdraw(app.id)} activeOpacity={0.85}>
                          <X color={Colors.critical} size={14} />
                          <Text style={styles.modRejectText}>Withdraw</Text>
                        </TouchableOpacity>
                        <View style={styles.modResolved}>
                          <Text style={[styles.modResolvedText, { color: Colors.accentDark }]}>{app.status.charAt(0).toUpperCase() + app.status.slice(1)}</Text>
                        </View>
                      </View>
                    ) : app.status === 'draft' ? (
                      <View style={styles.modActions}>
                        <TouchableOpacity
                          style={styles.modReviewBtn}
                          onPress={() => router.push(`/application?petId=${app.pet_id || ''}&type=${app.application_type}`)}
                          activeOpacity={0.85}
                        >
                          <FileText color={Colors.navy} size={14} />
                          <Text style={styles.modReviewText}>Continue</Text>
                        </TouchableOpacity>
                        <View style={styles.modResolved}>
                          <Text style={[styles.modResolvedText, { color: Colors.textTertiary }]}>Draft</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.modResolved}>
                        <Check color={app.status === 'approved' ? Colors.teal : app.status === 'declined' ? Colors.critical : Colors.textTertiary} size={14} />
                        <Text style={[styles.modResolvedText, { color: app.status === 'approved' ? Colors.tealDark : app.status === 'declined' ? Colors.critical : Colors.textTertiary }]}>
                          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* Received Applications (shelter members only) */}
            {isOrgAdmin && receivedApps.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Received Applications</Text>
                {receivedApps.map((app) => (
                  <View key={app.id} style={styles.modCard}>
                    <View style={styles.modHeader}>
                      <View style={styles.modIcon}>
                        <PawPrint color={Colors.navy} size={16} />
                      </View>
                      <View style={styles.modInfo}>
                        <Text style={styles.modType}>{app.pet_name} · {app.applicant_name}</Text>
                        <Text style={styles.modReason}>{app.application_type === 'foster' ? 'Foster' : 'Adoption'} · {formatShortDate(app.created_at)}</Text>
                      </View>
                    </View>
                    {app.status === 'pending' || app.status === 'draft' || app.status === 'submitted' ? (
                      <View style={styles.modActions}>
                        <TouchableOpacity
                          style={styles.modReviewBtn}
                          onPress={() => { setReviewingApp(app); setReviewNotes(app.reviewer_notes || ''); setReviewModalVisible(true); }}
                          activeOpacity={0.85}
                        >
                          <FileText color={Colors.navy} size={14} />
                          <Text style={styles.modReviewText}>Review</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.modResolved}>
                        <Check color={app.status === 'approved' ? Colors.teal : Colors.critical} size={14} />
                        <Text style={[styles.modResolvedText, { color: app.status === 'approved' ? Colors.tealDark : Colors.critical }]}>
                          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                        </Text>
                        {app.reviewer_notes ? <Text style={styles.modNotesPreview} numberOfLines={1}>· {app.reviewer_notes}</Text> : null}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* My Pets */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>My Pets</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => { closeDrawer(); router.push('/add-pet'); }} activeOpacity={0.85}>
                  <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>

              {/* Due Soon strip */}
              {reminders.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.remindersStrip} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                  {reminders.map((r, i) => {
                    const isOverdue = r.urgency === 'overdue';
                    const color = isOverdue ? Colors.critical : Colors.urgent;
                    const bg = isOverdue ? Colors.criticalBg : Colors.urgentBg;
                    const dayLabel = isOverdue
                      ? `${Math.abs(r.days_until_due)}d overdue`
                      : `due in ${r.days_until_due}d`;
                    return (
                      <TouchableOpacity
                        key={`${r.pet_id}-${i}`}
                        style={[styles.reminderChip, { backgroundColor: bg, borderColor: `${color}33` }]}
                        onPress={() => { closeDrawer(); router.push(`/my-pet?petId=${r.pet_id}`); }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.reminderPetName} numberOfLines={1}>{r.pet_name}</Text>
                        <Text style={styles.reminderSep}>—</Text>
                        <Text style={[styles.reminderLabel, { color }]} numberOfLines={1}>{r.label}</Text>
                        <Text style={[styles.reminderDue, { color }]}>{dayLabel}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {activePets.length === 0 && pastPets.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>No pets yet</Text>
                  <TouchableOpacity
                    style={styles.emptyAddBtn}
                    onPress={() => { closeDrawer(); router.push('/add-pet'); }}
                    activeOpacity={0.85}
                  >
                    <PawPrint color={Colors.white} size={16} />
                    <Text style={styles.emptyAddBtnText}>Add your first pet</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  {activePets.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.petRelCard}
                      onPress={() => { closeDrawer(); router.push(`/my-pet?petId=${p.pet_id}`); }}
                      activeOpacity={0.85}
                    >
                      {p.pet_photo ? (
                        <SignedImage path={p.pet_photo} style={styles.petRelPhoto} />
                      ) : (
                        <View style={[styles.petRelPhoto, styles.petRelPhotoFallback]}>
                          <PawPrint color={Colors.textTertiary} size={16} />
                        </View>
                      )}
                      <View style={styles.petRelInfo}>
                        <Text style={styles.petRelName}>{p.pet_name}</Text>
                        <Text style={styles.petRelMeta}>{[p.species, p.breed].filter(Boolean).join(' · ') || 'Pet'}</Text>
                        <Text style={styles.petRelRel}>{p.relationship.charAt(0).toUpperCase() + p.relationship.slice(1)} · Since {formatShortDate(p.started_on)}</Text>
                      </View>
                      <ChevronRight color={Colors.textTertiary} size={18} />
                    </TouchableOpacity>
                  ))}
                  {pastPets.length > 0 && (
                    <TouchableOpacity
                      style={styles.pastToggle}
                      onPress={() => setShowPastPets(!showPastPets)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.pastToggleText}>{showPastPets ? 'Hide' : 'Show'} Previously ({pastPets.length})</Text>
                    </TouchableOpacity>
                  )}
                  {showPastPets && pastPets.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.petRelCard, styles.petRelCardPast]}
                      onPress={() => { closeDrawer(); router.push(`/my-pet?petId=${p.pet_id}`); }}
                      activeOpacity={0.85}
                    >
                      {p.pet_photo ? (
                        <SignedImage path={p.pet_photo} style={styles.petRelPhoto} />
                      ) : (
                        <View style={[styles.petRelPhoto, styles.petRelPhotoFallback]}>
                          <PawPrint color={Colors.textTertiary} size={16} />
                        </View>
      )}
                      <View style={styles.petRelInfo}>
                        <Text style={styles.petRelName}>{p.pet_name}</Text>
                        <Text style={styles.petRelMeta}>{[p.species, p.breed].filter(Boolean).join(' · ') || 'Pet'}</Text>
                        <Text style={styles.petRelRel}>{p.relationship.charAt(0).toUpperCase() + p.relationship.slice(1)} · {formatShortDate(p.started_on)} – {formatShortDate(p.ended_on)}</Text>
                      </View>
                      <ChevronRight color={Colors.textTertiary} size={18} />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>

            {/* Foster Rating */}
            {fosterSummary && fosterSummary.rating_count > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Foster Rating</Text>
                <View style={styles.card}>
                  <View style={styles.ratingSummaryRow}>
                    <Text style={styles.ratingAvg}>{fosterSummary.avg_rating?.toFixed(1) || '0.0'}</Text>
                    <View style={styles.ratingStarsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Text key={star} style={[styles.ratingStar, { color: star <= Math.round(fosterSummary.avg_rating || 0) ? Colors.standard : Colors.border }]}>★</Text>
                      ))}
                    </View>
                    <Text style={styles.ratingCount}>{fosterSummary.rating_count} rating{fosterSummary.rating_count !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
                {fosterRatings.map((r) => (
                  <View key={r.id} style={styles.modCard}>
                    <View style={styles.modHeader}>
                      <View style={styles.modIcon}>
                        <Award color={Colors.navy} size={16} />
                      </View>
                      <View style={styles.modInfo}>
                        <Text style={styles.modType}>{r.rater_org_name || 'Organization'} · {r.pet_name || 'Pet'}</Text>
                        <Text style={styles.modReason}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {formatShortDate(r.created_at)}</Text>
                      </View>
                    </View>
                    {r.comment ? <Text style={styles.ratingComment}>{r.comment}</Text> : null}
                    {r.foster_response ? (
                      <Text style={styles.ratingResponse}>Your response: {r.foster_response}</Text>
                    ) : (
                      <TouchableOpacity
                        style={styles.modReviewBtn}
                        onPress={() => { setRatingModalId(r.id); setRatingResponse(''); }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.modReviewText}>Add response</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Services I Provide */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Services I Provide</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => openServiceModal(null)} activeOpacity={0.85}>
                  <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
              {services.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>No services listed yet</Text>
                </View>
              ) : (
                services.map((s) => (
                  <View key={s.id} style={styles.modCard}>
                    <View style={styles.modHeader}>
                      <View style={styles.modIcon}>
                        <PawPrint color={Colors.navy} size={16} />
                      </View>
                      <View style={styles.modInfo}>
                        <Text style={styles.modType}>{s.service_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</Text>
                        {s.details ? <Text style={styles.modReason} numberOfLines={2}>{s.details}</Text> : null}
                        {s.radius_km ? <Text style={styles.modReason}>Travel radius: {s.radius_km} km</Text> : null}
                        {!s.active && <Text style={[styles.modReason, { color: Colors.textTertiary }]}>Inactive</Text>}
                      </View>
                    </View>
                    <View style={styles.modActions}>
                      <TouchableOpacity style={styles.modReviewBtn} onPress={() => openServiceModal(s)} activeOpacity={0.85}>
                        <Text style={styles.modReviewText}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.modRejectBtn} onPress={() => deleteService(s.id)} activeOpacity={0.85}>
                        <X color={Colors.critical} size={14} />
                        <Text style={styles.modRejectText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* My Contributions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Contributions</Text>
              {contributions.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.emptyText}>No contributions logged yet</Text>
                </View>
              ) : (
                <>
                  {contribTotals.length > 0 && (
                    <View style={styles.contribTotalsRow}>
                      {contribTotals.map((t, i) => (
                        <View key={i} style={styles.contribTotalChip}>
                          <Text style={styles.contribTotalText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {contributions.map((c) => (
                    <View key={c.id} style={styles.modCard}>
                      <View style={styles.modHeader}>
                        <View style={styles.modIcon}>
                          <Heart color={Colors.coral} size={16} />
                        </View>
                        <View style={styles.modInfo}>
                          <Text style={styles.modType}>{c.contribution_type.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())}</Text>
                          <Text style={styles.modReason}>{c.org_name || 'Organization'} · {formatShortDate(c.occurred_on)}</Text>
                        </View>
                        {c.verified_at && (
                          <View style={styles.verifiedBadge}>
                            <Check color={Colors.tealDark} size={10} />
                            <Text style={styles.verifiedText}>Verified</Text>
                          </View>
                        )}
                      </View>
                      {c.description ? <Text style={styles.ratingComment}>{c.description}</Text> : null}
                      {c.amount_cents ? <Text style={styles.contribAmount}>${(c.amount_cents / 100).toFixed(2)}</Text> : null}
                      {c.quantity ? <Text style={styles.modReason}>Quantity: {c.quantity}</Text> : null}
                    </View>
                  ))}
                </>
              )}
            </View>

            {/* Activity links */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Activity</Text>
              <DrawerMenuItem icon={<Heart color={Colors.coral} size={18} />} title="Saved Pets" onPress={() => { closeDrawer(); router.push('/favorites'); }} />
              <DrawerMenuItem icon={<AlertTriangle color={Colors.urgent} size={18} />} title="My Reports" onPress={() => { closeDrawer(); router.push('/reports-tracking'); }} />
            </View>

            {/* Logout */}
            <View style={styles.section}>
              <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.8}>
                <LogOut color={Colors.critical} size={18} />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>

      {/* Application review modal */}
      <Modal visible={reviewModalVisible} animationType="slide" transparent onRequestClose={() => setReviewModalVisible(false)}>
        <View style={styles.reviewOverlay}>
          <View style={styles.reviewCard}>
            {reviewingApp && (
              <>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewTitle}>{reviewingApp.applicant_name}'s Application</Text>
                  <TouchableOpacity onPress={() => setReviewModalVisible(false)}>
                    <X color={Colors.text} size={22} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                  <Text style={styles.reviewSectionTitle}>Applicant</Text>
                  <Text style={styles.reviewDetail}>Name: {reviewingApp.applicant_name}</Text>
                  <Text style={styles.reviewDetail}>Email: {reviewingApp.applicant_email || 'N/A'}</Text>
                  <Text style={styles.reviewDetail}>Phone: {reviewingApp.applicant_phone || 'N/A'}</Text>

                  <Text style={styles.reviewSectionTitle}>Home</Text>
                  <Text style={styles.reviewDetail}>Housing: {reviewingApp.housing_type || 'N/A'}</Text>
                  <Text style={styles.reviewDetail}>{reviewingApp.owns_home ? 'Owns home' : 'Rents'}</Text>
                  {!reviewingApp.owns_home && <Text style={styles.reviewDetail}>Landlord: {reviewingApp.applicant_name || 'N/A'}</Text>}
                  <Text style={styles.reviewDetail}>Pets allowed: {reviewingApp.pets_allowed ? 'Yes' : 'No'}</Text>
                  <Text style={styles.reviewDetail}>Fenced yard: {reviewingApp.has_fenced_yard ? 'Yes' : 'No'}</Text>
                  <Text style={styles.reviewDetail}>Hours alone: {reviewingApp.hours_alone?.toString() || 'N/A'}</Text>
                  <Text style={styles.reviewDetail}>Adults: {reviewingApp.adults_count?.toString() || 'N/A'}</Text>
                  <Text style={styles.reviewDetail}>Children ages: {reviewingApp.children_ages || 'None'}</Text>

                  <Text style={styles.reviewSectionTitle}>Pets & Vet</Text>
                  <Text style={styles.reviewDetail}>Has other pets: {reviewingApp.has_other_pets ? 'Yes' : 'No'}</Text>
                  {reviewingApp.vet_clinic_name && <Text style={styles.reviewDetail}>Vet: {reviewingApp.vet_clinic_name}</Text>}
                  {reviewingApp.vet_phone && <Text style={styles.reviewDetail}>Vet phone: {reviewingApp.vet_phone}</Text>}
                  {reviewingApp.experience && <Text style={styles.reviewDetail}>Experience: {reviewingApp.experience}</Text>}

                  <Text style={styles.reviewSectionTitle}>Care Plan</Text>
                  <Text style={styles.reviewDetail}>Home type: {reviewingApp.home_type || 'N/A'}</Text>
                  {reviewingApp.message && <Text style={styles.reviewDetail}>Message: {reviewingApp.message}</Text>}

                  {reviewingApp.answers && Object.keys(reviewingApp.answers).length > 0 && (
                    <>
                      <Text style={styles.reviewSectionTitle}>Type-Specific Answers</Text>
                      {Object.entries(reviewingApp.answers).map(([key, value]) => (
                        <Text key={key} style={styles.reviewDetail}>{key.replace(/_/g, ' ')}: {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</Text>
                      ))}
                    </>
                  )}

                  <Text style={styles.reviewSectionTitle}>Consent</Text>
                  <Text style={styles.reviewDetail}>Home visit consent: {reviewingApp.home_visit_consent ? 'Yes' : 'No'}</Text>
                  <Text style={styles.reviewDetail}>Signature: {reviewingApp.attestation_signed_name || 'N/A'}</Text>

                  {reviewingApp.reviewer_notes && (
                    <>
                      <Text style={styles.reviewSectionTitle}>Previous Reviewer Notes</Text>
                      <Text style={styles.reviewDetail}>{reviewingApp.reviewer_notes}</Text>
                    </>
                  )}

                  <Text style={styles.reviewSectionTitle}>Reviewer Notes</Text>
                  <TextInput
                    style={[styles.reviewInput, { minHeight: 60, paddingTop: 12 }]}
                    value={reviewNotes}
                    onChangeText={setReviewNotes}
                    placeholder="Add private notes about this applicant..."
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    textAlignVertical="top"
                  />
                </ScrollView>

                <View style={styles.reviewActions}>
                  <TouchableOpacity style={styles.reviewApproveBtn} onPress={() => handleAppDecision(reviewingApp.id, 'approved')} activeOpacity={0.85}>
                    <Check color={Colors.tealDark} size={16} />
                    <Text style={styles.reviewApproveText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.reviewDeclineBtn} onPress={() => handleAppDecision(reviewingApp.id, 'declined')} activeOpacity={0.85}>
                    <X color={Colors.critical} size={16} />
                    <Text style={styles.reviewDeclineText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Foster rating response modal */}
      <Modal visible={ratingModalId !== null} animationType="slide" transparent onRequestClose={() => setRatingModalId(null)}>
        <View style={styles.reviewOverlay}>
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>Respond to Rating</Text>
              <TouchableOpacity onPress={() => setRatingModalId(null)}>
                <X color={Colors.text} size={22} />
              </TouchableOpacity>
            </View>
            <Text style={styles.reviewSectionTitle}>Your Response</Text>
            <TextInput
              style={[styles.reviewInput, { minHeight: 80, paddingTop: 12 }]}
              value={ratingResponse}
              onChangeText={setRatingResponse}
              placeholder="Share your perspective on this foster placement..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.reviewApproveBtn, { marginTop: 16 }]}
              onPress={() => saveFosterResponse(ratingModalId!)}
              activeOpacity={0.85}
            >
              <Text style={styles.reviewApproveText}>Save Response</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Service offer modal */}
      <Modal visible={serviceModalVisible} animationType="slide" transparent onRequestClose={() => setServiceModalVisible(false)}>
        <View style={styles.reviewOverlay}>
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>{editingService ? 'Edit Service' : 'Add Service'}</Text>
              <TouchableOpacity onPress={() => setServiceModalVisible(false)}>
                <X color={Colors.text} size={22} />
              </TouchableOpacity>
            </View>

            <Text style={styles.reviewSectionTitle}>Service Type</Text>
            <View style={styles.chipRow}>
              {['transport', 'foster', 'food', 'supplies', 'funds', 'vet_care', 'photography', 'admin', 'outreach'].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.serviceChip, serviceForm.service_type === s && styles.serviceChipActive]}
                  onPress={() => setServiceForm((p) => ({ ...p, service_type: s }))}
                >
                  <Text style={[styles.serviceChipText, serviceForm.service_type === s && styles.serviceChipTextActive]}>
                    {s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.reviewSectionTitle}>Details</Text>
            <TextInput
              style={[styles.reviewInput, { minHeight: 60, paddingTop: 12 }]}
              value={serviceForm.details}
              onChangeText={(v) => setServiceForm((p) => ({ ...p, details: v }))}
              placeholder="Describe what you can offer..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              textAlignVertical="top"
            />

            {serviceForm.service_type === 'transport' && (
              <>
                <Text style={styles.reviewSectionTitle}>Travel Radius (km)</Text>
                <TextInput
                  style={styles.reviewInput}
                  value={serviceForm.radius_km}
                  onChangeText={(v) => setServiceForm((p) => ({ ...p, radius_km: v }))}
                  placeholder="e.g. 50"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="numeric"
                />
              </>
            )}

            <View style={styles.serviceToggleRow}>
              <Text style={styles.serviceToggleLabel}>Active</Text>
              <Switch
                value={serviceForm.active}
                onValueChange={(v) => setServiceForm((p) => ({ ...p, active: v }))}
                trackColor={{ false: Colors.borderInput, true: Colors.teal }}
                thumbColor={Colors.white}
              />
            </View>

            <TouchableOpacity
              style={[styles.reviewApproveBtn, { marginTop: 16 }, savingService && { opacity: 0.6 }]}
              onPress={saveService}
              disabled={savingService}
              activeOpacity={0.85}
            >
              {savingService ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.reviewApproveText}>{editingService ? 'Save Changes' : 'Add Service'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function VerificationRow({ icon, label, pill }: { icon: React.ReactNode; label: string; pill: { bg: string; color: string; text: string } }) {
  return (
    <View style={styles.verifRow}>
      <View style={styles.verifLeft}>
        <View style={styles.verifIcon}>{icon}</View>
        <Text style={styles.verifLabel}>{label}</Text>
      </View>
      <View style={[styles.verifPill, { backgroundColor: pill.bg }]}>
        {pill.text === 'Verified' && <Check color={pill.color} size={11} />}
        <Text style={[styles.verifPillText, { color: pill.color }]}>{pill.text}</Text>
      </View>
    </View>
  );
}

function BadgeChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.badgeChip}>
      {icon}
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function DrawerMenuItem({ icon, title, onPress }: { icon: React.ReactNode; title: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.menuItemLeft}>
        <View style={styles.menuItemIcon}>{icon}</View>
        <Text style={styles.menuItemTitle}>{title}</Text>
      </View>
      <ChevronRight color={Colors.textTertiary} size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  flex: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },

  // Auth
  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.white },
  topNavLink: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
  topNavLinkActive: { color: Colors.coral },
  authScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  authHeader: { alignItems: 'center', marginBottom: 28 },
  authTitle: { fontSize: FontSizes['3xl'], fontFamily: Fonts.bold, color: Colors.text, marginBottom: 8 },
  authSubtitle: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  switchContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 24 },
  switchText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary },
  switchLink: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.coral },
  errorContainer: { backgroundColor: Colors.criticalBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  errorBox: { backgroundColor: Colors.criticalBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  errorText: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.critical, textAlign: 'center' },

  // Drawer
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,15,40,0.35)', zIndex: 90 },
  scrimTouchable: { flex: 1 },
  drawer: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    backgroundColor: Colors.screen, zIndex: 100,
    elevation: 16, shadowColor: Colors.shadow, shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 16,
  },
  drawerInner: { flex: 1 },
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.white,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  drawerTitle: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text },
  settingsButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  drawerScroll: { flex: 1 },
  drawerContent: { paddingHorizontal: 20, paddingBottom: 60 },

  // Profile section
  profileSection: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24, marginTop: 20 },
  avatarWrap: {},
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { backgroundColor: Colors.coral, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: FontSizes['2xl'], fontFamily: Fonts.bold, color: Colors.white },
  profileDetails: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: FontSizes.xl, fontFamily: Fonts.extrabold, color: Colors.text },
  userSubtitle: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 4 },

  // Sections
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  // Card
  card: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: Colors.border },

  // Verification rows
  verifRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 14 },
  verifLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verifIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  verifLabel: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  verifPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  verifPillText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold },

  // Privacy
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  privacyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  privacyLabel: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  privacyDesc: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },

  // Badges
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border },
  badgeText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.text },

  // Moderation
  modCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  modHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  modIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.urgentBg, justifyContent: 'center', alignItems: 'center' },
  modInfo: { flex: 1 },
  modType: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.text, textTransform: 'capitalize' },
  modReason: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  modActions: { flexDirection: 'row', gap: 8 },
  modApproveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.tealBg },
  modApproveText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.tealDark },
  modRejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.critical },
  modRejectText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.critical },
  modResolved: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modResolvedText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold },

  // Menu items
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuItemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  menuItemTitle: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },

  // Logout
  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  logoutText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.critical },

  emptyText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
  emptyAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.coral, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  emptyAddBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  remindersStrip: { marginBottom: 12 },
  reminderChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  reminderPetName: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.text, maxWidth: 80 },
  reminderSep: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary },
  reminderLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, maxWidth: 100 },
  reminderDue: { fontSize: FontSizes.xs, fontFamily: Fonts.semibold },
  notFoundTitle: { fontSize: FontSizes['2xl'], fontFamily: Fonts.bold, color: Colors.text, marginBottom: 8 },
  notFoundSub: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24, paddingHorizontal: 32, lineHeight: 22 },
  retryButton: { backgroundColor: Colors.coral, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  retryButtonText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },

  // Review modal
  reviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  reviewCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', padding: 20 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  reviewTitle: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, flex: 1 },
  reviewSectionTitle: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.navy, marginTop: 16, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewDetail: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20, marginBottom: 2 },
  reviewInput: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.surface, marginTop: 4 },
  reviewActions: { flexDirection: 'row', gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 12 },
  reviewApproveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.tealBg },
  reviewApproveText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.tealDark },
  reviewDeclineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.critical },
  reviewDeclineText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.critical },
  modReviewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surface },
  modReviewText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.navy },
  modNotesPreview: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary, flex: 1, marginLeft: 4 },

  // My Pets
  petRelCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  petRelCardPast: { opacity: 0.7 },
  petRelPhoto: { width: 48, height: 48, borderRadius: 24 },
  petRelPhotoFallback: { backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  petRelInfo: { flex: 1 },
  petRelName: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text },
  petRelMeta: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 1 },
  petRelRel: { fontSize: FontSizes.xs, fontFamily: Fonts.medium, color: Colors.textTertiary, marginTop: 2, textTransform: 'capitalize' },
  pastToggle: { paddingVertical: 10, alignItems: 'center' },
  pastToggleText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },

  // Foster ratings
  ratingSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  ratingAvg: { fontSize: FontSizes['3xl'], fontFamily: Fonts.bold, color: Colors.text },
  ratingStarsRow: { flexDirection: 'row', gap: 2 },
  ratingStar: { fontSize: FontSizes.lg },
  ratingCount: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  ratingComment: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.text, lineHeight: 20, marginBottom: 6 },
  ratingResponse: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, fontStyle: 'italic', color: Colors.tealDark, lineHeight: 20 },

  // Services
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surface },
  addBtnText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.coral },
  serviceChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginBottom: 6 },
  serviceChipActive: { backgroundColor: Colors.coral, borderColor: Colors.coral },
  serviceChipText: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.text },
  serviceChipTextActive: { color: Colors.white, fontFamily: Fonts.bold },
  serviceToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  serviceToggleLabel: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },

  // Contributions
  contribTotalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  contribTotalChip: { backgroundColor: Colors.tealBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  contribTotalText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.tealDark },
  contribAmount: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text, marginTop: 4 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.tealBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.tealDark },

  // Application Info section
  appProfileNote: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary, fontStyle: 'italic', marginBottom: 10, lineHeight: 16 },
  appProfileRow: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.text, lineHeight: 20, marginBottom: 2 },
  appProfileLabel: { fontFamily: Fonts.semibold, color: Colors.textSecondary },
});
