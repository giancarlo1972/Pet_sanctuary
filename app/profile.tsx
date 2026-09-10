import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { pickImage } from '@/lib/pick-image';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Switch, TextInput, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, ChevronRight, ShieldCheck, LogOut, Phone, IdCard, GraduationCap,
  PawPrint, Plus, Sparkles, MoreVertical,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/lib/context/AuthContext';
import SignInPrompt from '@/components/SignInPrompt';
import { ConfirmDialog, type ConfirmConfig } from '@/components/ConfirmDialog';
import { isPlatformAdmin } from '@/lib/admin-access';
import { supabase } from '@/lib/supabase';
import { Page } from '@/components/Page';
import { InlineBanner } from '@/components/InlineBanner';
import SignedImage from '@/components/SignedImage';
import { isUsablePhoto } from '@/lib/photos';
import OnDutyCard from '@/components/OnDutyCard';
import MeStatsPanel from '@/components/MeStatsPanel';
import VisibilityCard from '@/components/VisibilityCard';
import {
  ROLE_CARDS, TABS_BY_VIEW, SUBS, PROVIDER_SERVICES, normalizeCategories,
  dashAction, type RoleCategory,
} from '@/lib/role-categories';
import { hoursLeft, serviceLabel } from '@/lib/helper-duty';

type PetRel = {
  id: string; pet_id: string; pet_name: string; pet_photo: string | null;
  species: string | null; relationship: string; ended_on: string | null; listing?: string | null; status?: string | null;
};

function statusTone(st: string) {
  const v = (st || '').toLowerCase();
  if (/(approved|confirmed|active|completed|verified)/.test(v)) return { bg: Colors.tealBg, fg: Colors.tealDark };
  if (/(pending|requested|draft|submitted)/.test(v)) return { bg: Colors.standardBg, fg: Colors.accentDark };
  if (/(declined|cancelled|ended|rejected)/.test(v)) return { bg: Colors.criticalBg, fg: Colors.critical };
  return { bg: Colors.surface, fg: Colors.textSecondary };
}

export default function ProfileScreen() {
  const { user, loading: authLoading, signOut, actingIsPlatform } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!user) {
    return (
      <SafeAreaView style={s.wrap}>
        {(!mounted || authLoading) ? null : (
          <SignInPrompt title="Sign in to see your profile" message="Pets, applications, favorites, and on-duty settings stay on your account." />
        )}
      </SafeAreaView>
    );
  }
  if (!mounted || authLoading) {
    return <SafeAreaView style={[s.wrap, s.center]}><ActivityIndicator color={Colors.coral} /></SafeAreaView>;
  }
  return <Me userId={user.id} email={user.email || ''} signOut={signOut} actingIsPlatform={actingIsPlatform} />;
}

function Me({ userId, email, signOut, actingIsPlatform }: {
  userId: string; email: string; signOut: () => Promise<void>; actingIsPlatform: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [name, setName] = useState('Member');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [since, setSince] = useState<string | null>(null);
  const [cats, setCats] = useState<RoleCategory[]>(['owner']);
  const [view, setView] = useState<RoleCategory>('owner');
  const [tab, setTab] = useState('pets');
  const [sub, setSub] = useState('own');
  const [verified, setVerified] = useState(false);
  const [verif, setVerif] = useState({ id_verified: false, phone_verified: false, responder_training: 'none', id_status: '' as string, phone: '' as string });
  const [ownerOn, setOwnerOn] = useState(true);
  const [volOn, setVolOn] = useState(false);
  const [respOn, setRespOn] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [idBusy, setIdBusy] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [duty, setDuty] = useState<{ on: boolean; services: string[]; radius: number; hours: number; n: number } | null>(null);

  const [pets, setPets] = useState<PetRel[]>([]);
  const [apps, setApps] = useState<{ id: string; pet_name: string; application_type: string; status: string }[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; title: string; kind: string; status: string; goal_amount?: number | null; raised_amount?: number | null }[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [orgPets, setOrgPets] = useState<PetRel[]>([]);
  const [shared, setShared] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string; status?: string }[]>([]);
  const [provider, setProvider] = useState<any | null>(null);
  const [helpReqs, setHelpReqs] = useState<any[]>([]);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);

  const tabs = TABS_BY_VIEW[view];
  const subs = SUBS[tab] || [];
  const showPlatform = actingIsPlatform || isPlatformAdmin(null, email);

  useEffect(() => {
    if (!tabs.some((t) => t.key === tab)) setTab(tabs[0].key);
  }, [view, tabs, tab]);
  useEffect(() => {
    if (subs.length && !subs.some((x) => x.key === sub)) setSub(subs[0].key);
  }, [tab, subs, sub]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: row, error } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, address_city, address_state, role_categories, onboarding_done, pet_owner_active, volunteer_active, responder_active, created_at, role')
      .eq('id', userId)
      .maybeSingle();
    if (error && /onboarding_done|role_categories/.test(error.message || '')) {
      const retry = await supabase.from('profiles').select('full_name, avatar_url, address_city, address_state, created_at').eq('id', userId).maybeSingle();
      const p = retry.data as any;
      setName(p?.full_name || 'Member');
      setAvatar(p?.avatar_url || null);
      setCity([p?.address_city, p?.address_state].filter(Boolean).join(', '));
      setSince(p?.created_at || null);
      setLoading(false);
      return;
    }
    const p = row as any;
    if (p && p.onboarding_done === false) {
      router.replace('/onboarding');
      return;
    }
    const nextCats = normalizeCategories(p?.role_categories);
    setCats(nextCats);
    setView((v) => (nextCats.includes(v) ? v : nextCats[0]));
    setName(p?.full_name || 'Member');
    setAvatar(p?.avatar_url || null);
    setCity([p?.address_city, p?.address_state].filter(Boolean).join(', '));
    setSince(p?.created_at || null);
    setOwnerOn(p?.pet_owner_active !== false);
    setVolOn(Boolean(p?.volunteer_active));
    setRespOn(Boolean(p?.responder_active));

    const { data: v } = await supabase.from('user_verifications').select('id_verified, phone_verified, responder_training, id_status, phone').eq('user_id', userId).maybeSingle();
    if (v) {
      setVerif(v as any);
      setVerified(Boolean(v.id_verified && v.phone_verified));
      if ((v as any).phone) setPhone((v as any).phone);
    }

    const { data: hs } = await supabase.from('helper_status').select('*').eq('user_id', userId).maybeSingle();
    const { count } = await supabase.from('help_requests').select('id', { count: 'exact', head: true }).eq('helper_id', userId).eq('status', 'pending');
    if (hs?.on_duty) {
      setDuty({
        on: true,
        services: hs.services || [],
        radius: hs.radius_mi || 5,
        hours: hoursLeft(hs.until_at),
        n: count || 0,
      });
    } else setDuty(null);

    const [{ data: rels }, { data: owned }] = await Promise.all([
      supabase.from('pet_relationships')
        .select('id, pet_id, relationship, ended_on, pets(id, name, species, main_photo_url, listing_type, status)')
        .eq('user_id', userId),
      supabase.from('pets').select('id, name, species, main_photo_url, listing_type, status').eq('owner_id', userId),
    ]);
    const ids = [...new Set([...(rels || []).map((r: any) => r.pet_id), ...(owned || []).map((p: any) => p.id)])].filter(Boolean);
    const { data: petRows } = ids.length ? await supabase.from('pets').select('id, name, species, main_photo_url, listing_type, status, shelter_id').in('id', ids) : { data: [] as any[] };
    const pmap: Record<string, any> = {};
    (petRows || []).forEach((x: any) => { pmap[x.id] = x; });
    const mapped: PetRel[] = [];
    for (const r of rels || []) {
      const nested = Array.isArray((r as any).pets) ? (r as any).pets[0] : (r as any).pets;
      const pet = nested || pmap[r.pet_id];
      mapped.push({
        id: r.id, pet_id: r.pet_id, pet_name: pet?.name || 'Pet', pet_photo: pet?.main_photo_url || null,
        species: pet?.species || null, relationship: r.relationship, ended_on: r.ended_on,
        listing: pet?.listing_type, status: pet?.status,
      });
    }
    for (const o of owned || []) {
      if (mapped.some((m) => m.pet_id === o.id && !m.ended_on)) continue;
      mapped.push({
        id: 'own-' + o.id, pet_id: o.id, pet_name: o.name || 'Pet', pet_photo: o.main_photo_url,
        species: o.species, relationship: 'own', ended_on: null, listing: o.listing_type, status: o.status,
      });
    }
    setPets(mapped);

    const { data: myApps } = await supabase.from('my_applications').select('id, application_type, status, pet_id').order('created_at', { ascending: false }).limit(40);
    const appPetIds = [...new Set(((myApps || []) as any[]).map((a) => a.pet_id).filter(Boolean))];
    const { data: named } = appPetIds.length ? await supabase.from('pets').select('id, name').in('id', appPetIds) : { data: [] as any[] };
    const nmap: Record<string, string> = {};
    (named || []).forEach((x: any) => { nmap[x.id] = x.name; });
    setApps(((myApps || []) as any[]).map((a) => ({
      id: a.id, application_type: a.application_type, status: a.status, pet_name: nmap[a.pet_id] || 'Pet',
    })));

    const { data: camps } = await supabase.from('campaigns').select('id, title, kind, status, goal_amount, raised_amount').or(`manager_id.eq.${userId}`).order('created_at', { ascending: false }).limit(40);
    setCampaigns((camps as any[]) || []);

    const { data: bks } = await supabase.from('service_bookings').select('*').or(`provider_id.eq.${userId},client_id.eq.${userId}`).order('starts_at', { ascending: false }).limit(40);
    setBookings((bks as any[]) || []);

    const { data: revs } = await supabase.from('service_reviews').select('*').eq('provider_id', userId).order('created_at', { ascending: false }).limit(40);
    setReviews((revs as any[]) || []);

    const { data: spp } = await supabase.from('service_provider_profiles').select('*').eq('user_id', userId).maybeSingle();
    setProvider(spp || null);

    const { data: hr } = await supabase.from('help_requests').select('id, status, service, created_at').eq('helper_id', userId).order('created_at', { ascending: false }).limit(20);
    setHelpReqs((hr as any[]) || []);

    const [{ count: followN }, { count: shareN }] = await Promise.all([
      supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('follower_id', userId),
      supabase.from('pet_relationships').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).is('ended_on', null)
        .in('relationship', ['caretaker', 'co_owner', 'co-owner', 'veterinarian', 'sponsor', 'sponsored']),
    ]);
    setFriendCount((followN || 0) + (shareN || 0));

    const { data: mem } = await supabase.from('organization_members').select('organization_id, organizations(id, name, status)').eq('user_id', userId);
    const orgList = ((mem || []) as any[]).map((m) => ({ id: m.organizations?.id || m.organization_id, name: m.organizations?.name || 'Organization', status: m.organizations?.status })).filter((o) => o.id);
    setOrgs(orgList);
    if (orgList[0]) {
      const { data: op } = await supabase.from('pets').select('id, name, species, main_photo_url, listing_type, status').eq('shelter_id', orgList[0].id).limit(80);
      setOrgPets(((op || []) as any[]).map((x) => ({
        id: x.id, pet_id: x.id, pet_name: x.name, pet_photo: x.main_photo_url, species: x.species,
        relationship: 'org', ended_on: null, listing: x.listing_type, status: x.status,
      })));
      const { data: ss } = await supabase.from('shared_services').select('*').or(`from_org_id.eq.${orgList[0].id},to_org_id.eq.${orgList[0].id}`).limit(40);
      setShared((ss as any[]) || []);
      const { data: members } = await supabase.from('organization_members').select('user_id, role, profiles(full_name, email)').eq('organization_id', orgList[0].id).limit(40);
      setOrgMembers((members as any[]) || []);
    } else {
      setOrgPets([]); setShared([]); setOrgMembers([]);
    }

    setLoading(false);
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const uploadId = async () => {
    setIdBusy(true);
    try {
      const picked = await pickImage();
      if (!picked) { setIdBusy(false); return; }
      const path = `${userId}/id-${Date.now()}.jpg`;
      const { error: up } = await supabase.storage.from('identity-docs').upload(path, picked.blob, { contentType: 'image/jpeg', upsert: true });
      if (up) throw up;
      const { error: uvErr } = await supabase.from('user_verifications').upsert({
        user_id: userId, id_document_path: path, id_status: 'submitted', id_verified: false,
      });
      if (uvErr) throw uvErr;
      setVerif((v) => ({ ...v, id_verified: false, id_status: 'submitted' }));
      setBanner({ kind: 'success', message: 'ID submitted · awaiting review.' });
    } catch (e: any) {
      setBanner({ kind: 'error', message: e?.message || 'ID upload failed.' });
    } finally { setIdBusy(false); }
  };

  const sendPhoneCode = async () => {
    const ph = phone.trim();
    if (!ph) { setBanner({ kind: 'error', message: 'Enter a phone number first.' }); return; }
    setPhoneBusy(true);
    await supabase.auth.updateUser({ phone: ph });
    const { error: otpErr } = await supabase.auth.signInWithOtp({ phone: ph });
    if (otpErr) { setBanner({ kind: 'error', message: otpErr.message || 'Could not send code.' }); setPhoneBusy(false); return; }
    setOtpSent(true);
    setBanner({ kind: 'success', message: 'Code sent. Enter the 6 digits below.' });
    setPhoneBusy(false);
  };

  const verifyPhoneCode = async () => {
    const ph = phone.trim();
    const token = otp.trim();
    if (token.length < 6) { setBanner({ kind: 'error', message: 'Enter the 6-digit code.' }); return; }
    setPhoneBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: ph, token, type: 'sms' });
    if (error) { setBanner({ kind: 'error', message: error.message || 'Code did not match.' }); setPhoneBusy(false); return; }
    await supabase.from('user_verifications').upsert({ user_id: userId, phone_verified: true, phone: ph });
    setVerif((v) => ({ ...v, phone_verified: true, phone: ph }));
    setBanner({ kind: 'success', message: 'Phone verified.' });
    setPhoneBusy(false);
  };

  const saveFlags = async (patch: Record<string, any>) => {
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
    if (error) setBanner({ kind: 'error', message: error.message || 'Could not save.' });
  };

  const petBucket = (r: PetRel) => {
    const rel = (r.relationship || '').toLowerCase();
    if (rel === 'foster') return 'foster';
    if (rel === 'own' || rel === 'owner') return 'own';
    if (rel === 'org' || rel === 'manager') return 'manage';
    if (rel === 'co_owner' || rel === 'co-owner' || rel === 'caretaker' || rel === 'veterinarian' || rel === 'sponsor' || rel === 'sponsored') return 'shared';
    return 'shared';
  };

  const petRows = pets.filter((r) => !r.ended_on && petBucket(r) === sub);
  const appRows = apps.filter((a) => {
    if (sub === 'adoption') return a.application_type !== 'foster' && a.application_type !== 'volunteer';
    if (sub === 'foster') return a.application_type === 'foster';
    return a.application_type === 'volunteer';
  });
  const campRows = campaigns.filter((c) => c.status === sub);
  const now = Date.now();
  const bookingRows = bookings.filter((b) => {
    const start = new Date(b.starts_at).getTime();
    if (sub === 'requests') return b.status === 'requested' && b.provider_id === userId;
    if (sub === 'past') return b.status === 'completed' || b.status === 'declined' || b.status === 'cancelled' || start < now;
    return (b.status === 'confirmed' || b.status === 'requested') && start >= now;
  });
  const orgPetRows = orgPets.filter((p) => {
    const st = (p.status || p.listing || '').toLowerCase();
    if (sub === 'adoptable') return /adopt/.test(st) && !/adopted/.test(st);
    if (sub === 'foster') return /foster/.test(st);
    if (sub === 'hold') return /hold|medical/.test(st);
    if (sub === 'adopted') return /adopted/.test(st);
    return true;
  });
  const sharedRows = shared.filter((x) => (sub === 'offered' ? x.from_org_id === orgs[0]?.id : x.to_org_id === orgs[0]?.id));

  const countsFor = (tabKey: string) => {
    const keys = SUBS[tabKey] || [];
    const out: Record<string, number> = {};
    for (const k of keys) {
      if (tabKey === 'pets') out[k.key] = pets.filter((r) => !r.ended_on && petBucket(r) === k.key).length;
      else if (tabKey === 'apps') out[k.key] = apps.filter((a) => {
        if (k.key === 'adoption') return a.application_type !== 'foster' && a.application_type !== 'volunteer';
        if (k.key === 'foster') return a.application_type === 'foster';
        return a.application_type === 'volunteer';
      }).length;
      else if (tabKey === 'campaigns') out[k.key] = campaigns.filter((c) => c.status === k.key).length;
      else if (tabKey === 'bookings') out[k.key] = bookings.filter((b) => {
        const start = new Date(b.starts_at).getTime();
        if (k.key === 'requests') return b.status === 'requested' && b.provider_id === userId;
        if (k.key === 'past') return b.status === 'completed' || b.status === 'declined' || b.status === 'cancelled' || start < Date.now();
        return (b.status === 'confirmed' || b.status === 'requested') && start >= Date.now();
      }).length;
      else if (tabKey === 'petmgmt') out[k.key] = orgPets.filter((p) => {
        const st = (p.status || p.listing || '').toLowerCase();
        if (k.key === 'adoptable') return /adopt/.test(st) && !/adopted/.test(st);
        if (k.key === 'foster') return /foster/.test(st);
        if (k.key === 'hold') return /hold|medical/.test(st);
        if (k.key === 'adopted') return /adopted/.test(st);
        return true;
      }).length;
      else if (tabKey === 'shared') out[k.key] = shared.filter((x) => (k.key === 'offered' ? x.from_org_id === orgs[0]?.id : x.to_org_id === orgs[0]?.id)).length;
      else if (tabKey === 'services') {
        if (k.key === 'offered') out[k.key] = (provider?.services || []).length;
        else if (k.key === 'duty') out[k.key] = duty?.on ? 1 : 0;
        else out[k.key] = helpReqs.length;
      } else if (tabKey === 'company') {
        if (k.key === 'members') out[k.key] = orgMembers.length;
        else out[k.key] = orgs.length ? 1 : 0;
      } else out[k.key] = 0;
    }
    return out;
  };
  const counts = useMemo(() => countsFor(tab), [tab, pets, apps, campaigns, bookings, orgPets, shared, provider, duty, helpReqs, orgMembers, orgs, userId]);

  const year = since ? new Date(since).getFullYear() : null;
  const action = dashAction(tab);

  const petCount = pets.filter((r) => !r.ended_on).length;
  const volunteerEntries = apps.filter((a) => a.application_type === 'volunteer').length
    + (duty?.services?.length || 0)
    + (volOn && !(duty?.services?.length) ? 1 : 0);
  const servicesCount = (provider?.services || []).length + volunteerEntries;

  const setMe2Tab = (label: string) => {
    if (label === 'Friends') { router.push('/friends'); return; }
    const order: RoleCategory[] = [view, ...cats.filter((c) => c !== view), 'owner', 'provider', 'organization', 'campaign'];
    for (const v of order) {
      const t = TABS_BY_VIEW[v]?.find((x) => x.label === label);
      if (t) { setView(v); setTab(t.key); return; }
    }
  };

  const setBooking = async (id: string, status: string) => {
    const { error } = await supabase.from('service_bookings').update({ status }).eq('id', id);
    if (error) { setBanner({ kind: 'error', message: error.message }); return; }
    load();
  };
  const leaveReview = async (b: any) => {
    const { error } = await supabase.from('service_reviews').insert({
      booking_id: b.id, provider_id: b.provider_id, reviewer_id: userId, rating: 5, body: 'Great care.',
    });
    if (error) { setBanner({ kind: 'error', message: error.message }); return; }
    await setBooking(b.id, 'completed');
  };

  const rows = (() => {
    if (tab === 'pets') return petRows.map((r) => ({
      key: r.id, title: r.pet_name, sub: [r.species, r.relationship].filter(Boolean).join(' · '),
      status: r.ended_on ? 'Past' : 'Active', href: `/pet-record?petId=${r.pet_id}`, color: Colors.coral, photo: r.pet_photo,
    }));
    if (tab === 'apps') return appRows.map((a) => ({
      key: a.id, title: a.pet_name, sub: a.application_type, status: a.status, href: '/(tabs)/pets', color: Colors.navy,
    }));
    if (tab === 'campaigns') return campRows.map((c) => ({
      key: c.id, title: c.title, sub: `${c.kind}${c.goal_amount ? ` · $${c.raised_amount || 0} / $${c.goal_amount}` : ''}`,
      status: c.status, href: '/campaign-new', color: '#8A5A00',
    }));
    if (tab === 'bookings') return bookingRows.map((b) => ({
      key: b.id, title: PROVIDER_SERVICES.find((x) => x.key === b.service)?.label || b.service,
      sub: [
        b.pet_id ? 'Pet profile shared' : (b.species ? String(b.species).charAt(0).toUpperCase() + String(b.species).slice(1) : 'Animal'),
        new Date(b.starts_at).toLocaleString(),
      ].join(' · '),
      status: b.status, href: null, color: Colors.teal, booking: b,
    }));
    if (tab === 'reviews') return reviews.map((r) => ({
      key: r.id, title: `${r.rating}★`, sub: r.body || 'Review', status: 'Published', href: null, color: Colors.accent,
    }));
    if (tab === 'petmgmt') return orgPetRows.map((r) => ({
      key: r.id, title: r.pet_name, sub: r.species || 'Pet', status: r.status || r.listing || 'Listed',
      href: `/pet-record?petId=${r.pet_id}`, color: Colors.navy, photo: r.pet_photo,
    }));
    if (tab === 'shared') return sharedRows.map((x) => ({
      key: x.id, title: x.service, sub: x.note || x.status, status: x.status, href: '/share-service', color: Colors.teal,
    }));
    if (tab === 'orgs') return orgs.map((o) => ({
      key: o.id, title: o.name, sub: 'Organization', status: o.status || 'active', href: `/organization-details?id=${o.id}`, color: Colors.navy,
    }));
    if (tab === 'services' && sub === 'offered') {
      const svcs = (provider?.services || []) as string[];
      return svcs.map((k) => ({
        key: k, title: PROVIDER_SERVICES.find((x) => x.key === k)?.label || serviceLabel(k),
        sub: provider?.rate_text || `${provider?.radius_mi || 10} mi`, status: provider?.verified ? 'Verified' : 'Listed',
        href: '/service-provider', color: Colors.teal,
      }));
    }
    if (tab === 'services' && sub === 'history') return helpReqs.map((h) => ({
      key: h.id, title: serviceLabel(h.service || 'help'), sub: new Date(h.created_at).toLocaleDateString(),
      status: h.status, href: null, color: Colors.navy,
    }));
    if (tab === 'company' && sub === 'members') return orgMembers.map((m: any) => ({
      key: m.user_id, title: m.profiles?.full_name || m.profiles?.email || 'Member', sub: m.role, status: 'Active', href: '/org-admin', color: Colors.navy,
    }));
    if (tab === 'company') return orgs.map((o) => ({
      key: o.id, title: o.name, sub: sub === 'verification' ? (o.status === 'approved' ? 'Verified' : 'Pending') : 'Profile',
      status: o.status || 'draft', href: '/org-admin', color: Colors.navy,
    }));
    if (tab === 'orgservices') return [];
    if (tab === 'donors') return campaigns.filter((c) => c.kind === 'fundraising').map((c) => ({
      key: c.id, title: c.title, sub: `$${c.raised_amount || 0} raised`, status: c.status, href: '/campaign-new', color: '#8A5A00',
    }));
    return [];
  })();

  const emptyLabel = (subs.find((x) => x.key === sub)?.label || tab).toLowerCase();

  const askSignOut = () => {
    setMenuOpen(false);
    setConfirmConfig({
      title: 'Sign out?',
      message: 'You can sign back in anytime.',
      confirmText: 'Sign out',
      onConfirm: async () => { await signOut(); },
    });
  };

  const switchAccount = async () => {
    setMenuOpen(false);
    await signOut();
    router.replace('/auth');
  };

  return (
    <SafeAreaView style={s.wrap} edges={['top']}>
      <Page>
        {banner ? <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} /> : null}

        <View style={s.header}>
          <TouchableOpacity style={s.back} onPress={() => router.replace('/(tabs)')} activeOpacity={0.8}>
            <ChevronLeft color={Colors.navy} size={22} />
          </TouchableOpacity>
          {isUsablePhoto(avatar) ? <SignedImage path={avatar} style={s.avatar} /> : (
            <View style={[s.avatar, s.avatarFb]}><Text style={s.avTxt}>{name.charAt(0).toUpperCase()}</Text></View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.name} numberOfLines={1}>{name}</Text>
              {verified ? <ShieldCheck color={Colors.teal} size={16} /> : null}
            </View>
            <Text style={s.meta} numberOfLines={1}>{[city || email, year ? `member since ${year}` : null].filter(Boolean).join(' · ')}</Text>
          </View>
          <TouchableOpacity style={s.menuBtn} onPress={() => setMenuOpen(true)} activeOpacity={0.85} accessibilityLabel="Account menu">
            <MoreVertical color={Colors.navy} size={18} />
          </TouchableOpacity>
          {showPlatform ? (
            <TouchableOpacity style={s.plat} onPress={() => router.push('/platform')} activeOpacity={0.85}>
              <Text style={s.platTxt}>Platform</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <MeStatsPanel
          view={view}
          pets={petCount}
          services={servicesCount}
          friends={friendCount}
          setMe2Tab={setMe2Tab}
        />
        {(provider || volOn) ? (
          <VisibilityCard
            userId={userId}
            volunteerActive={volOn}
            onBanner={(kind, message) => setBanner({ kind, message })}
            onChanged={load}
          />
        ) : null}

        <View style={s.navy}>
          <Text style={s.navyK}>ROLE CATEGORIES</Text>
          <View style={s.chips}>
            {ROLE_CARDS.map((c) => {
              const held = cats.includes(c.key);
              const selected = view === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[s.rc, held && s.rcHeld, selected && s.rcOn]}
                  onPress={() => held ? setView(c.key) : router.push('/onboarding?add=1')}
                  activeOpacity={0.85}
                >
                  <Text style={[s.rcTxt, !held && s.rcTxtOff]}>{c.title}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.navyHint}>Org and Campaign tools unlock after verification.</Text>
        </View>

        {duty?.on ? (
          <View style={s.duty}>
            <Text style={s.dutyTxt}>● On duty · {(duty.services.map(serviceLabel).join(', ') || 'help')} · {duty.radius} mi · {duty.hours < 1 ? '<1' : Math.round(duty.hours)}h left</Text>
            <Text style={s.dutyN}>{duty.n} request{duty.n === 1 ? '' : 's'}</Text>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {tabs.map((t) => (
            <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabOn]} onPress={() => setTab(t.key)} activeOpacity={0.85}>
              <Text style={[s.tabTxt, tab === t.key && s.tabTxtOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {tab !== 'identity' ? (
          <>
            {subs.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subs}>
                {subs.map((x) => (
                  <TouchableOpacity key={x.key} style={[s.sub, sub === x.key && s.subOn]} onPress={() => setSub(x.key)}>
                    <Text style={[s.subTxt, sub === x.key && s.subTxtOn]}>{x.label} {counts[x.key] ?? 0}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            {tab === 'services' && sub === 'duty' ? (
              <OnDutyCard userId={userId} phoneVerified={verif.phone_verified} onBanner={(kind, message) => setBanner({ kind, message })} />
            ) : loading ? <ActivityIndicator color={Colors.coral} /> : rows.length === 0 ? (
              <View style={s.empty}><Text style={s.emptyTxt}>Nothing in {emptyLabel} yet</Text></View>
            ) : rows.map((r: any) => {
              const tone = statusTone(r.status);
              return (
                <TouchableOpacity key={r.key} style={s.row} onPress={() => r.href && router.push(r.href as any)} activeOpacity={0.85} disabled={!r.href && !r.booking}>
                  {r.photo && isUsablePhoto(r.photo) ? <SignedImage path={r.photo} style={s.tileImg} /> : (
                    <View style={[s.tile, { backgroundColor: r.color }]}>
                      {tab === 'services' ? <Sparkles color={Colors.white} size={16} /> : <PawPrint color={Colors.white} size={16} />}
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>{r.title}</Text>
                    <Text style={s.rowSub} numberOfLines={1}>{r.sub}</Text>
                  </View>
                  <View style={[s.st, { backgroundColor: tone.bg }]}><Text style={[s.stTxt, { color: tone.fg }]}>{r.status}</Text></View>
                  {r.booking && r.booking.provider_id === userId && r.booking.status === 'requested' ? (
                    <View style={{ gap: 4 }}>
                      <TouchableOpacity onPress={() => setBooking(r.booking.id, 'confirmed')}><Text style={s.ok}>Confirm</Text></TouchableOpacity>
                      <TouchableOpacity onPress={() => setBooking(r.booking.id, 'declined')}><Text style={s.no}>Decline</Text></TouchableOpacity>
                    </View>
                  ) : r.booking && r.booking.client_id === userId && r.booking.status === 'confirmed' ? (
                    <TouchableOpacity onPress={() => leaveReview(r.booking)}><Text style={s.ok}>Review</Text></TouchableOpacity>
                  ) : <ChevronRight color={Colors.textTertiary} size={16} />}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={s.dash} onPress={() => router.push(action.href as any)} activeOpacity={0.85}>
              <Plus color={Colors.coral} size={16} />
              <Text style={s.dashTxt}>{action.label}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ gap: 14 }}>
            <View style={s.card}>
              <ToggleRow label="Pet owner" value={ownerOn} onChange={(v) => { setOwnerOn(v); saveFlags({ pet_owner_active: v }); }} />
              <ToggleRow label="Volunteer" value={volOn} onChange={(v) => { setVolOn(v); saveFlags({ volunteer_active: v }); }} />
              <ToggleRow
                label="First responder"
                value={respOn}
                locked={!verif.id_verified || !verif.phone_verified || verif.responder_training !== 'passed'}
                onChange={(v) => { setRespOn(v); saveFlags({ responder_active: v }); }}
              />
            </View>

            <View style={s.card}>
              <Text style={s.kicker}>TRUST & VERIFICATION</Text>
              <Verif label="Government ID" icon={<IdCard color={Colors.navy} size={16} />} pill={verif.id_verified ? 'Verified' : verif.id_status === 'submitted' ? 'Submitted' : 'Tap to upload'} onPress={idBusy ? undefined : uploadId} ok={verif.id_verified} />
              <View style={s.div} />
              <View style={{ padding: 12, gap: 8 }}>
                <Verif label="Phone" icon={<Phone color={Colors.navy} size={16} />} pill={verif.phone_verified ? 'Verified' : 'Not verified'} ok={verif.phone_verified} />
                {!verif.phone_verified ? (
                  <>
                    <TextInput style={s.input} value={phone} onChangeText={setPhone} placeholder="+1 555 555 0100" placeholderTextColor={Colors.textTertiary} keyboardType="phone-pad" />
                    <TouchableOpacity onPress={sendPhoneCode} disabled={phoneBusy}><Text style={s.link}>{phoneBusy ? 'Sending…' : 'Send code'}</Text></TouchableOpacity>
                    {otpSent ? (
                      <>
                        <TextInput style={s.input} value={otp} onChangeText={setOtp} placeholder="6-digit code" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" maxLength={6} />
                        <TouchableOpacity onPress={verifyPhoneCode} disabled={phoneBusy}><Text style={s.link}>{phoneBusy ? 'Checking…' : 'Verify code'}</Text></TouchableOpacity>
                      </>
                    ) : null}
                  </>
                ) : null}
              </View>
              <View style={s.div} />
              <Verif label="Responder training" icon={<GraduationCap color={Colors.navy} size={16} />} pill={verif.responder_training === 'passed' ? 'Passed' : verif.responder_training === 'in_review' ? 'In review' : 'Not started'} ok={verif.responder_training === 'passed'} />
            </View>

            <TouchableOpacity style={s.dash} onPress={() => router.push('/onboarding?add=1')} activeOpacity={0.85}>
              <Plus color={Colors.coral} size={16} />
              <Text style={s.dashTxt}>Add another role</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={s.logout} onPress={askSignOut} activeOpacity={0.8}>
          <LogOut color={Colors.coral} size={18} />
          <Text style={s.logoutTxt}>Sign out</Text>
        </TouchableOpacity>
      </Page>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} activeOpacity={1} />
          <View style={s.sheet}>
            <TouchableOpacity style={s.sheetRow} onPress={() => { setMenuOpen(false); router.push('/edit-profile'); }} activeOpacity={0.85}>
              <Text style={s.sheetTxt}>Edit profile</Text>
            </TouchableOpacity>
            <View style={s.sheetDiv} />
            <TouchableOpacity style={s.sheetRow} onPress={switchAccount} activeOpacity={0.85}>
              <Text style={s.sheetTxt}>Switch account</Text>
            </TouchableOpacity>
            <View style={s.sheetDiv} />
            <TouchableOpacity style={s.sheetRow} onPress={askSignOut} activeOpacity={0.85}>
              <Text style={s.sheetDanger}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ConfirmDialog config={confirmConfig} onClose={() => setConfirmConfig(null)} />
    </SafeAreaView>
  );
}

function ToggleRow({ label, value, onChange, locked }: { label: string; value: boolean; onChange: (v: boolean) => void; locked?: boolean }) {
  return (
    <View style={s.toggle}>
      <View>
        <Text style={s.rowTitle}>{label}</Text>
        {locked ? <Text style={s.lock}>Locked until verified</Text> : null}
      </View>
      <Switch value={value} disabled={locked} onValueChange={onChange} trackColor={{ true: Colors.teal, false: Colors.border }} />
    </View>
  );
}

function Verif({ label, icon, pill, onPress, ok }: { label: string; icon: React.ReactNode; pill: string; onPress?: () => void; ok?: boolean }) {
  const inner = (
    <View style={s.verif}>
      <View style={s.verifIcon}>{icon}</View>
      <Text style={[s.rowTitle, { flex: 1 }]}>{label}</Text>
      <View style={[s.st, { backgroundColor: ok ? Colors.tealBg : Colors.surface }]}>
        <Text style={[s.stTxt, { color: ok ? Colors.tealDark : Colors.textSecondary }]}>{pill}</Text>
      </View>
    </View>
  );
  if (!onPress) return inner;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.85}>{inner}</TouchableOpacity>;
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: Colors.border, marginTop: 8 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFb: { backgroundColor: Colors.coral, alignItems: 'center', justifyContent: 'center' },
  avTxt: { fontFamily: Fonts.bold, color: Colors.white, fontSize: 18 },
  name: { fontFamily: Fonts.extrabold, fontSize: 16, color: Colors.navy, flexShrink: 1 },
  meta: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  plat: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: Colors.navy },
  platTxt: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.white },
  menuBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  duty: { backgroundColor: Colors.tealBg, borderRadius: 12, padding: 12, gap: 4 },
  dutyTxt: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.tealDark },
  dutyN: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.tealDark },
  tabs: { gap: 8, paddingVertical: 4 },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  tabOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  tabTxt: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy },
  tabTxtOn: { color: Colors.white },
  subs: { gap: 8, paddingBottom: 4 },
  sub: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: Colors.teal, backgroundColor: Colors.white },
  subOn: { backgroundColor: Colors.tealBg },
  subTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.tealDark },
  subTxtOn: { color: Colors.tealDark },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.border, borderRadius: 16, padding: 22, alignItems: 'center', backgroundColor: Colors.white },
  emptyTxt: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border },
  tile: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileImg: { width: 40, height: 40, borderRadius: 10 },
  tileMark: { color: Colors.white, fontFamily: Fonts.extrabold, fontSize: 14 },
  rowTitle: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy },
  rowSub: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  st: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  stTxt: { fontFamily: Fonts.bold, fontSize: 11 },
  dash: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: Colors.white },
  dashTxt: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.coral },
  navy: { backgroundColor: '#26265E', borderRadius: 16, padding: 14, gap: 10 },
  navyK: { fontFamily: Fonts.extrabold, fontSize: 11, letterSpacing: 0.8, color: '#B9BCE0' },
  navyHint: { fontFamily: Fonts.regular, fontSize: 12, color: '#B9BCE0' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rc: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'transparent' },
  rcHeld: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.45)' },
  rcOn: { backgroundColor: Colors.coral, borderColor: Colors.coral },
  rcTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.white },
  rcTxtOff: { color: 'rgba(255,255,255,0.55)' },
  card: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 11, letterSpacing: 0.8, color: Colors.textTertiary, paddingHorizontal: 14, paddingTop: 12 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  lock: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.coral, marginTop: 2 },
  verif: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  verifIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  div: { height: 1, backgroundColor: Colors.border },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontFamily: Fonts.regular, color: Colors.navy },
  link: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.coral },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, marginTop: 8 },
  logoutTxt: { fontFamily: Fonts.semibold, fontSize: 15, color: Colors.coral },
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28, paddingTop: 8 },
  sheetRow: { paddingHorizontal: 20, paddingVertical: 16 },
  sheetTxt: { fontFamily: Fonts.semibold, fontSize: 16, color: Colors.navy },
  sheetDanger: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.coral },
  sheetDiv: { height: 1, backgroundColor: Colors.border, marginHorizontal: 20 },
  ok: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.tealDark },
  no: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.critical },
});
