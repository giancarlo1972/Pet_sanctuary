import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ChevronRight,
  Building2,
  Plus,
  ShieldCheck,
  PawPrint,
  MoreVertical,
  Pencil,
  Trash2,
  Flag,
  Sparkles,
} from 'lucide-react-native';
import { InlineBanner } from '@/components/InlineBanner';
import { ConfirmDialog, type ConfirmConfig } from '@/components/ConfirmDialog';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import SignedImage from '@/components/SignedImage';
import { PROVIDER_SERVICES } from '@/lib/role-categories';
import { orgSection, ORG_TILE, ORG_TYPE_LABEL } from '@/lib/org-type';
import type { Story } from '@/types';

type Segment = 'orgs' | 'fosters' | 'stories' | 'services';

interface OrgRow {
  id: string;
  name: string;
  org_type: string | null;
  location: string | null;
  logo_url: string | null;
  description: string | null;
  status: string | null;
  ein_verified: boolean | null;
  tax_deductible: boolean | null;
  data_source?: string | null;
  updated_at?: string | null;
  pets_count: number;
  fosters_count: number;
}

const ORG_CACHE_KEY = 'ra_community_orgs_v2';
const ORG_PAGE = 50;
const INTER = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.regular;
const INTERB = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.bold;
const INTEREB = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.extrabold;

const orgCache = {
  async getItem(key: string) {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    } catch { /* ignore */ }
    return null;
  },
  async setItem(key: string, value: string) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch { /* ignore */ }
  },
};

async function readOrgCache(): Promise<OrgRow[] | null> {
  try {
    const raw = await orgCache.getItem(ORG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeOrgCache(rows: OrgRow[]) {
  orgCache.setItem(ORG_CACHE_KEY, JSON.stringify(rows)).catch(() => {});
}

function mapOrgRow(o: any): OrgRow {
  return {
    id: o.id,
    name: o.name,
    org_type: o.org_type,
    location: [o.city, o.state].filter(Boolean).join(', ') || null,
    logo_url: o.logo_url,
    description: o.description || null,
    status: o.status,
    ein_verified: o.ein_verified ?? null,
    tax_deductible: o.tax_deductible ?? null,
    data_source: o.data_source || null,
    updated_at: o.updated_at || null,
    pets_count: Number(o.pets_count) || 0,
    fosters_count: Number(o.fosters_count) || 0,
  };
}

interface FosterPet {
  id: string;
  name: string;
  breed: string | null;
  species: string;
  description: string | null;
  main_photo_url: string | null;
  age_text: string | null;
  gender: string | null;
  personality: string[] | null;
  good_with_kids: boolean | null;
  good_with_dogs: boolean | null;
  good_with_cats: boolean | null;
  vaccinated: boolean | null;
  spayed_neutered: boolean | null;
  shelter_name: string | null;
}

interface ProviderRow {
  user_id: string;
  name: string;
  avatar_url: string | null;
  services: string[];
  is_volunteer: boolean;
  rating: number | null;
  reviews_count: number;
  radius_mi: number;
}

const TYPE_FILTERS = ['All', 'Shelters', 'Rescue groups', 'Clinics', 'Sponsors'] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const FILTER_TO_SECTION: Record<TypeFilter, string> = {
  All: 'all',
  Shelters: 'shelter',
  'Rescue groups': 'rescue',
  Clinics: 'clinic',
  Sponsors: 'sponsor',
};

const STORY_TYPE_LABELS: Record<string, string> = {
  adoption: 'Adoption',
  foster: 'Foster',
  rescue: 'Rescue',
  reunion: 'Reunion',
  memorial: 'Memorial',
  update: 'Update',
};

function timeAgo(dateString: string | null): string {
  if (!dateString) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function bannerAgo(dateString: string | null): string {
  if (!dateString) return '5 min ago';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function attachPetCounts(rows: OrgRow[]): Promise<OrgRow[]> {
  const ids = rows.map((r) => r.id).filter(Boolean);
  if (!ids.length) return rows;
  try {
    const { data, error } = await supabase
      .from('pets')
      .select('shelter_id, availability')
      .in('shelter_id', ids)
      .limit(2000);
    if (error || !data) return rows;
    const listed: Record<string, number> = {};
    const fosters: Record<string, number> = {};
    for (const p of data as { shelter_id?: string | null; availability?: string | null }[]) {
      const sid = p.shelter_id;
      if (!sid) continue;
      listed[sid] = (listed[sid] || 0) + 1;
      const av = String(p.availability || '').toLowerCase();
      if (av === 'foster' || av === 'both') fosters[sid] = (fosters[sid] || 0) + 1;
    }
    return rows.map((r) => ({
      ...r,
      pets_count: listed[r.id] || 0,
      fosters_count: fosters[r.id] || 0,
    }));
  } catch {
    return rows;
  }
}

function PulseDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.25, duration: 700, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.apiDot, { opacity }]} />;
}

export default function CommunityScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ seg?: string }>();
  const [activeSegment, setActiveSegment] = useState<Segment>(params.seg === 'services' ? 'services' : 'orgs');
  const [orgQuery, setOrgQuery] = useState('');
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orgHasMore, setOrgHasMore] = useState(false);
  const [syncedAgo, setSyncedAgo] = useState('5 min ago');
  const orgPageRef = useRef(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [fosterPets, setFosterPets] = useState<FosterPet[]>([]);
  const [fostersLoading, setFostersLoading] = useState(false);
  const [appliedFosters, setAppliedFosters] = useState<Set<string>>(new Set());
  const [stories, setStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [menuStoryId, setMenuStoryId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState(false);

  useEffect(() => {
    if (params.seg === 'services') setActiveSegment('services');
  }, [params.seg]);

  const loadFosters = useCallback(async () => {
    setFostersLoading(true);
    try {
      const { data, error } = await supabase
        .from('pets')
        .select(`
          id, name, breed, species, description, main_photo_url,
          age_text, gender, personality, good_with_kids, good_with_dogs, good_with_cats,
          vaccinated, spayed_neutered,
          shelters!inner(name)
        `)
        .eq('is_public', true)
        .in('availability', ['foster', 'both'])
        .order('created_at', { ascending: false });
      if (!error && data) {
        setFosterPets(data.map((p: any) => ({
          id: p.id,
          name: p.name,
          breed: p.breed,
          species: p.species,
          description: p.description,
          main_photo_url: p.main_photo_url,
          age_text: p.age_text,
          gender: p.gender,
          personality: p.personality,
          good_with_kids: p.good_with_kids,
          good_with_dogs: p.good_with_dogs,
          good_with_cats: p.good_with_cats,
          vaccinated: p.vaccinated,
          spayed_neutered: p.spayed_neutered,
          shelter_name: p.shelters?.name ?? null,
        })));
      }
    } catch { /* ignore */ }
    setFostersLoading(false);
  }, []);

  const loadOrgs = useCallback(async (opts?: { append?: boolean }) => {
    const append = Boolean(opts?.append);
    const page = append ? orgPageRef.current + 1 : 0;
    const from = page * ORG_PAGE;
    const to = from + ORG_PAGE - 1;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const full = 'id, name, org_type, city, state, logo_url, status, data_source, ein_verified, updated_at';
      const slim = 'id, name, org_type, city, state, logo_url, status, data_source';
      let { data, error } = await supabase
        .from('organizations')
        .select(full)
        .eq('status', 'approved')
        .order('name', { ascending: true })
        .range(from, to);
      if (error) {
        const retry = await supabase
          .from('organizations')
          .select(slim)
          .eq('status', 'approved')
          .order('name', { ascending: true })
          .range(from, to);
        data = retry.data as typeof data;
        error = retry.error;
      }
      const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
      console.log('[community] orgs query', ms, 'ms');
      if (error || !data) return;
      let rows = data.map(mapOrgRow);
      rows = await attachPetCounts(rows);
      orgPageRef.current = page;
      setOrgHasMore(rows.length === ORG_PAGE);
      const stamps = rows
        .map((r) => r.updated_at)
        .filter((d): d is string => Boolean(d))
        .sort()
        .reverse();
      if (stamps[0]) setSyncedAgo(bannerAgo(stamps[0]));
      else if (!append) setSyncedAgo('5 min ago');
      setOrgs((prev) => (append ? [...prev, ...rows] : rows));
      if (!append) writeOrgCache(rows);
    } catch { /* keep cache */ }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadStories = useCallback(async () => {
    setStoriesLoading(true);
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id, author_id, organization_id, pet_id, title, body,
          cover_photo_url, photo_urls, story_type, status,
          published_at, created_at, updated_at,
          profiles!inner(full_name, avatar_url),
          organizations(name, logo_url),
          pets(name, main_photo_url)
        `)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(30);
      if (!error && data) {
        setStories(data.map((s: any) => ({
          id: s.id,
          author_id: s.author_id,
          organization_id: s.organization_id,
          pet_id: s.pet_id,
          title: s.title,
          body: s.body,
          cover_photo_url: s.cover_photo_url,
          photo_urls: s.photo_urls || [],
          story_type: s.story_type,
          status: s.status,
          published_at: s.published_at,
          created_at: s.created_at,
          updated_at: s.updated_at,
          author_name: s.profiles?.full_name || null,
          author_avatar: s.profiles?.avatar_url || null,
          org_name: s.organizations?.name || null,
          org_logo: s.organizations?.logo_url || null,
          pet_name: s.pets?.name || null,
          pet_photo: s.pets?.main_photo_url || null,
        })));
      }
    } catch { /* ignore */ }
    setStoriesLoading(false);
  }, []);

  const loadProviders = useCallback(async () => {
    setProvidersLoading(true);
    try {
      const { data, error } = await supabase
        .from('public_service_providers')
        .select('user_id, full_name, avatar_url, services, is_volunteer, rating, reviews_count, radius_mi, show_on_map')
        .limit(80);
      if (error) {
        setProviders([]);
        setProvidersError(true);
        if (user) setBanner({ message: 'Could not load service providers.', kind: 'error' });
        return;
      }
      setProvidersError(false);
      setProviders((data || []).map((d: any) => ({
        user_id: d.user_id,
        name: d.full_name || 'Provider',
        avatar_url: d.avatar_url || null,
        services: d.services || [],
        is_volunteer: Boolean(d.is_volunteer),
        rating: d.rating != null ? Number(d.rating) : null,
        reviews_count: d.reviews_count || 0,
        radius_mi: d.radius_mi || 10,
      })));
    } catch {
      setProviders([]);
      setProvidersError(true);
      if (user) setBanner({ message: 'Could not load service providers.', kind: 'error' });
    } finally {
      setProvidersLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    let live = true;
    readOrgCache().then((cached) => {
      if (!live || !cached?.length) return;
      setOrgs(cached);
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  useEffect(() => { loadFosters(); loadStories(); loadProviders(); }, [loadFosters, loadStories, loadProviders]);
  useFocusEffect(useCallback(() => { loadOrgs(); }, [loadOrgs]));

  const getSection = (org: OrgRow) => orgSection(org.org_type);

  const filteredOrgs = (typeFilter === 'All' ? orgs : orgs.filter((o) => getSection(o) === FILTER_TO_SECTION[typeFilter]))
    .filter((o) => {
      const q = orgQuery.trim().toLowerCase();
      if (!q) return true;
      return o.name.toLowerCase().includes(q) || (o.location || '').toLowerCase().includes(q);
    });

  const getStatusPill = (org: OrgRow, section: string) => {
    if (section === 'clinic') return { label: 'Care Fund partner', bg: '#FCF4DF', color: '#8A5A00' };
    if (section === 'sponsor') return { label: 'Sponsor', bg: '#FCF4DF', color: '#8A5A00' };
    if (org.ein_verified) return { label: '501(c)(3) verified', bg: '#E4F3F1', color: '#1D6D66' };
    return { label: 'Verification pending', bg: '#EFF1F5', color: '#6B7280' };
  };

  const orgSubline = (org: OrgRow, section: string) => {
    const typeLabel = ORG_TYPE_LABEL[section as keyof typeof ORG_TYPE_LABEL] || 'Organization';
    if (section === 'clinic') return `${typeLabel} · Emergency partner`;
    if (section === 'sponsor') return `${typeLabel} · Helps shelters & animals in need`;
    if (section === 'rescue') {
      const n = org.fosters_count || org.pets_count || 0;
      return `${typeLabel} · ${n} active foster${n === 1 ? '' : 's'}`;
    }
    const n = org.pets_count || 0;
    return `${typeLabel} · ${n} pets listed`;
  };

  const renderOrgRow = (org: OrgRow) => {
    const section = getSection(org);
    const pill = getStatusPill(org, section);
    const tile = ORG_TILE[section] || ORG_TILE.other;
    const showShield = org.status === 'approved' || Boolean(org.ein_verified);
    return (
      <TouchableOpacity
        key={org.id}
        style={styles.orgRow}
        onPress={() => router.push(`/organization-details?id=${org.id}`)}
        activeOpacity={0.85}
      >
        <View style={[styles.orgInitialTile, { backgroundColor: tile }]}>
          <Text style={styles.orgInitialText}>{org.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.orgInfo}>
          <View style={styles.orgNameRow}>
            <Text style={styles.orgName} numberOfLines={1}>{org.name}</Text>
            {showShield ? <ShieldCheck color="#2E9E96" size={15} /> : null}
          </View>
          <Text style={styles.orgMeta} numberOfLines={1}>{orgSubline(org, section)}</Text>
          <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.statusPillText, { color: pill.color }]}>{pill.label}</Text>
          </View>
        </View>
        <ChevronRight color="#9AA1AC" size={18} />
      </TouchableOpacity>
    );
  };

  const getFosterChips = (p: FosterPet): string[] => {
    const chips: string[] = [];
    if (p.age_text) chips.push(p.age_text);
    if (p.gender) chips.push(p.gender.charAt(0).toUpperCase() + p.gender.slice(1));
    if (p.vaccinated) chips.push('Vaccinated');
    if (p.spayed_neutered) chips.push('Spayed/Neutered');
    if (p.good_with_kids) chips.push('Good with kids');
    if (p.good_with_dogs) chips.push('Good with dogs');
    if (p.good_with_cats) chips.push('Good with cats');
    if (p.personality && p.personality.length > 0) chips.push(...p.personality.slice(0, 2));
    return chips.slice(0, 4);
  };

  const renderFosterCard = (p: FosterPet) => {
    const applied = appliedFosters.has(p.id);
    const chips = getFosterChips(p);
    return (
      <View key={p.id} style={styles.fosterCard}>
        <View style={styles.fosterPhotoWrap}>
          {p.main_photo_url ? (
            <SignedImage path={p.main_photo_url} style={styles.fosterPhoto} />
          ) : (
            <View style={[styles.fosterPhoto, styles.fosterPhotoFallback]}>
              <PawPrint color={Colors.textTertiary} size={28} />
            </View>
          )}
        </View>
        <View style={styles.fosterBody}>
          <Text style={styles.fosterName}>{p.name}</Text>
          <Text style={styles.fosterBreed}>
            {[p.breed, p.shelter_name ? `via ${p.shelter_name}` : null].filter(Boolean).join(' · ')}
          </Text>
          {p.description ? (
            <Text style={styles.fosterNeed} numberOfLines={2}>{p.description}</Text>
          ) : null}
          {chips.length > 0 && (
            <View style={styles.fosterChipsRow}>
              {chips.map((chip, i) => (
                <View key={i} style={styles.fosterChip}>
                  <Text style={styles.fosterChipText}>{chip}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.fosterButtons}>
            <TouchableOpacity
              style={styles.fosterViewBtn}
              onPress={() => router.push(`/pet-details?id=${p.id}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.fosterViewText}>View profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fosterApplyBtn, applied && styles.fosterAppliedBtn]}
              onPress={() => {
                setAppliedFosters((prev) => new Set(prev).add(p.id));
                router.push(`/application?petId=${p.id}&type=foster`);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.fosterApplyText}>
                {applied ? 'Applied ✓' : 'Apply to foster'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const handleDeleteStory = (storyId: string) => {
    setMenuStoryId(null);
    setConfirmConfig({
      title: 'Delete story?',
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        try {
          await supabase.from('stories').delete().eq('id', storyId);
          setStories((prev) => prev.filter((s) => s.id !== storyId));
        } catch (err) {
          console.error('[community] delete story failed:', err);
          setBanner({ message: 'Could not delete the story.', kind: 'error' });
        }
      },
    });
  };

  const handleReportStory = async (storyId: string) => {
    setMenuStoryId(null);
    try {
      await supabase.from('story_reports').insert({ story_id: storyId });
      setBanner({ message: 'Thank you. Our team will review this story.', kind: 'success' });
    } catch (err) {
      console.error('[community] report story failed:', err);
      setBanner({ message: 'Could not submit report. Please try again.', kind: 'error' });
    }
  };

  const renderStoryCard = (s: Story) => {
    const displayName = s.org_name || s.author_name || 'Rescue Army';
    const displayAvatar = s.org_logo || s.author_avatar;
    return (
      <View key={s.id} style={styles.storyCard}>
        <TouchableOpacity
          style={styles.storyCardTouchable}
          onPress={() => router.push(`/story-details?id=${s.id}`)}
          activeOpacity={0.85}
        >
          <View style={styles.storyImageWrap}>
            {s.cover_photo_url ? (
              <Image source={{ uri: s.cover_photo_url }} style={styles.storyImage} resizeMode="cover" />
            ) : (
              <View style={[styles.storyImage, styles.storyImageFallback]}>
                <PawPrint color={Colors.white} size={32} />
              </View>
            )}
            <View style={styles.storyTagPill}>
              <Text style={styles.storyTagText}>{STORY_TYPE_LABELS[s.story_type] || s.story_type}</Text>
            </View>
          </View>
          <Text style={styles.storyTitle} numberOfLines={2}>{s.title}</Text>
          <View style={styles.storyAuthorRow}>
            {displayAvatar ? (
              <Image source={{ uri: displayAvatar }} style={styles.storyAuthorAvatar} />
            ) : (
              <View style={[styles.storyAuthorAvatar, styles.storyAuthorAvatarFallback]}>
                <Text style={styles.storyAuthorInitial}>{displayName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.storyMeta} numberOfLines={1}>{displayName} · {timeAgo(s.published_at || s.created_at)}</Text>
          </View>
          <Text style={styles.storyExcerpt} numberOfLines={2}>{s.body}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.storyMenuBtn}
          onPress={() => setMenuStoryId(s.id)}
          activeOpacity={0.75}
        >
          <MoreVertical color={Colors.textTertiary} size={18} />
        </TouchableOpacity>
      </View>
    );
  };

  const menuStory = stories.find((s) => s.id === menuStoryId);
  const menuStoryIsOwner = user && menuStory && user.id === menuStory.author_id;

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Community" />
      <Page
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadOrgs();
            loadStories();
            loadFosters();
            loadProviders();
          }} />
        }
      >
      <View style={styles.segmentContainer}>
        {(['orgs', 'fosters', 'stories', 'services'] as Segment[]).map((seg) => (
          <TouchableOpacity
            key={seg}
            style={[styles.segment, activeSegment === seg && styles.segmentActive]}
            onPress={() => setActiveSegment(seg)}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentText, activeSegment === seg && styles.segmentTextActive]}>
              {seg === 'orgs' ? 'Orgs' : seg === 'fosters' ? 'Fosters' : seg === 'stories' ? 'Stories' : 'Services'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {(loading && activeSegment !== 'services' && orgs.length === 0) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.coral} />
        </View>
      ) : (
        <>
          {activeSegment === 'orgs' && (
            <>
              <View style={styles.apiBanner}>
                <PulseDot />
                <Text style={styles.apiBannerText}>
                  <Text style={styles.apiBannerBold}>Connected to RescueGroups.org API</Text>
                  {` — ${orgs.length} organizations synced · updated ${syncedAgo}`}
                </Text>
              </View>
              <TextInput
                style={styles.orgSearch}
                value={orgQuery}
                onChangeText={setOrgQuery}
                placeholder="Search shelters, rescues, city…"
                placeholderTextColor={Colors.textTertiary}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipsRow}
              >
                {TYPE_FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, typeFilter === f && styles.filterChipActive]}
                    onPress={() => setTypeFilter(f)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.filterChipText, typeFilter === f && styles.filterChipTextActive]}>
                      {f}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={styles.orgRegisterCTA}
                onPress={() => router.push('/register-organization')}
                activeOpacity={0.85}
              >
                <View style={styles.orgRegisterCTAIcon}>
                  <Plus color={Colors.coral} size={20} />
                </View>
                <View style={styles.registerCTAInfo}>
                  <Text style={styles.registerCTATitle}>Register your organization</Text>
                  <Text style={styles.registerCTASub}>Get verified · unlock 501(c)(3) tax benefits for donors</Text>
                </View>
                <ChevronRight color="#9AA1AC" size={18} />
              </TouchableOpacity>
              {filteredOrgs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Building2 color={Colors.textTertiary} size={40} />
                  <Text style={styles.emptyTitle}>No organizations found</Text>
                  <Text style={styles.emptyDesc}>Try a different search or filter.</Text>
                </View>
              ) : (
                <>
                  {filteredOrgs.map(renderOrgRow)}
                  {orgHasMore && !orgQuery.trim() && typeFilter === 'All' ? (
                    <TouchableOpacity style={styles.showMoreBtn} onPress={() => loadOrgs({ append: true })} activeOpacity={0.85}>
                      <Text style={styles.showMoreText}>Show more</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </>
          )}
          {activeSegment === 'fosters' && (
            <>
              {fostersLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors.coral} />
                </View>
              ) : fosterPets.length === 0 ? (
                <View style={styles.emptyState}>
                  <PawPrint color={Colors.textTertiary} size={40} />
                  <Text style={styles.emptyTitle}>No pets need fosters near you right now</Text>
                  <Text style={styles.emptyDesc}>Check back soon — shelters post new foster needs regularly.</Text>
                </View>
              ) : (
                fosterPets.map(renderFosterCard)
              )}
            </>
          )}
          {activeSegment === 'stories' && (
            <>
              {user && (
                <TouchableOpacity
                  style={styles.shareStoryCTA}
                  onPress={() => router.push('/story-composer')}
                  activeOpacity={0.85}
                >
                  <View style={styles.shareStoryIcon}>
                    <Plus color={Colors.coral} size={20} />
                  </View>
                  <View style={styles.shareStoryInfo}>
                    <Text style={styles.shareStoryTitle}>Share your story</Text>
                    <Text style={styles.shareStorySub}>Inspire others with a rescue, adoption, or reunion</Text>
                  </View>
                  <ChevronRight color={Colors.coral} size={18} />
                </TouchableOpacity>
              )}
              {storiesLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors.coral} />
                </View>
              ) : stories.length === 0 ? (
                <View style={styles.emptyState}>
                  <PawPrint color={Colors.textTertiary} size={40} />
                  <Text style={styles.emptyTitle}>No stories yet</Text>
                  <Text style={styles.emptyDesc}>
                    {user ? 'Be the first to share a rescue story.' : 'Check back soon for inspiring rescue stories.'}
                  </Text>
                </View>
              ) : (
                stories.map(renderStoryCard)
              )}
            </>
          )}
          {activeSegment === 'services' && (
            <>
              {user ? (
                <TouchableOpacity
                  style={styles.registerCTA}
                  onPress={() => router.push('/service-provider')}
                  activeOpacity={0.85}
                >
                  <View style={styles.registerCTAIcon}>
                    <Plus color={Colors.coral} size={20} />
                  </View>
                  <View style={styles.registerCTAInfo}>
                    <Text style={styles.registerCTATitle}>Offer a service</Text>
                    <Text style={styles.registerCTASub}>Sit, walk, groom, train, or transport — owners and shelters book you here</Text>
                  </View>
                  <ChevronRight color={Colors.coral} size={18} />
                </TouchableOpacity>
              ) : null}
              {providersLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors.coral} />
                </View>
              ) : providersError && !user ? (
                <View style={styles.emptyState}>
                  <Sparkles color={Colors.textTertiary} size={40} />
                  <Text style={styles.emptyTitle}>Sign in to see service providers</Text>
                  <Text style={styles.emptyDesc}>Sitters, walkers, and trainers list their services here.</Text>
                  <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/auth')} activeOpacity={0.85}>
                    <Text style={styles.signInBtnText}>Sign in</Text>
                  </TouchableOpacity>
                </View>
              ) : providersError ? (
                <View style={styles.emptyState}>
                  <Sparkles color={Colors.textTertiary} size={40} />
                  <Text style={styles.emptyTitle}>Could not load service providers</Text>
                  <Text style={styles.emptyDesc}>Pull to refresh and try again.</Text>
                </View>
              ) : providers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Sparkles color={Colors.textTertiary} size={40} />
                  <Text style={styles.emptyTitle}>No sitters or walkers listed yet</Text>
                  <Text style={styles.emptyDesc}>
                    {user ? 'Be the first to offer a service near you.' : 'Sign in to book a sitter, walker, or trainer.'}
                  </Text>
                </View>
              ) : (
                providers.map((p) => {
                  const rating = p.rating != null ? `${p.rating.toFixed(1)}★ · ${p.reviews_count} review${p.reviews_count === 1 ? '' : 's'}` : 'New';
                  return (
                    <View key={p.user_id} style={styles.orgRow}>
                      <View style={[styles.orgInitialTile, { backgroundColor: Colors.teal, overflow: 'hidden' }]}>
                        {p.avatar_url ? (
                          <Image source={{ uri: p.avatar_url }} style={styles.providerAvatar} />
                        ) : (
                          <Text style={styles.orgInitialText}>✦</Text>
                        )}
                      </View>
                      <View style={styles.orgInfo}>
                        <View style={styles.orgNameRow}>
                          <Text style={styles.orgName} numberOfLines={1}>{p.name}</Text>
                          {p.is_volunteer ? <ShieldCheck color={Colors.teal} size={15} /> : null}
                        </View>
                        <Text style={styles.orgMeta} numberOfLines={1}>
                          {[rating, `${p.radius_mi} mi`].filter(Boolean).join(' · ')}
                        </Text>
                        <View style={styles.fosterChipsRow}>
                          {p.is_volunteer ? (
                            <View style={styles.fosterChip}>
                              <Text style={styles.fosterChipText}>Volunteer</Text>
                            </View>
                          ) : null}
                          {(p.services || []).slice(0, 4).map((k) => (
                            <View key={k} style={styles.fosterChip}>
                              <Text style={styles.fosterChipText}>{PROVIDER_SERVICES.find((x) => x.key === k)?.label || k}</Text>
                            </View>
                          ))}
                        </View>
                        <TouchableOpacity
                          style={styles.bookBtn}
                          onPress={() => {
                            if (!user) { router.push('/auth'); return; }
                            if (p.user_id === user.id) { router.push('/service-provider'); return; }
                            router.push(`/book-service?providerId=${p.user_id}`);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.bookBtnTxt}>{user && p.user_id === user.id ? 'Edit your listing' : 'Request booking'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </>
          )}
        </>
      )}
      {menuStory && (
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuStoryId(null)}>
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />
            {menuStoryIsOwner && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { setMenuStoryId(null); router.push(`/story-composer?editId=${menuStory.id}`); }}
                activeOpacity={0.75}
              >
                <Pencil color={Colors.navy} size={18} />
                <Text style={styles.menuItemText}>Edit story</Text>
              </TouchableOpacity>
            )}
            {menuStoryIsOwner && (
              <TouchableOpacity style={styles.menuItem} onPress={() => handleDeleteStory(menuStory.id)} activeOpacity={0.75}>
                <Trash2 color={Colors.critical} size={18} />
                <Text style={[styles.menuItemText, { color: Colors.critical }]}>Delete story</Text>
              </TouchableOpacity>
            )}
            {!menuStoryIsOwner && user && (
              <TouchableOpacity style={styles.menuItem} onPress={() => handleReportStory(menuStory.id)} activeOpacity={0.75}>
                <Flag color={Colors.critical} size={18} />
                <Text style={[styles.menuItemText, { color: Colors.critical }]}>Report this story</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      )}
      {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
      <ConfirmDialog config={confirmConfig} onClose={() => setConfirmConfig(null)} />
      </Page>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  orgSearch: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
    fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 999,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 999,
  },
  segmentActive: { backgroundColor: Colors.navy },
  segmentText: {
    fontSize: 12, fontFamily: Fonts.semibold, color: Colors.textSecondary,
  },
  segmentTextActive: { color: Colors.white },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100, maxWidth: 720, width: '100%', alignSelf: 'center' },
  apiBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F1F2F8', borderRadius: 14, padding: 14, marginBottom: 16,
  },
  apiDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#2E9E96',
  },
  apiBannerText: {
    flex: 1, fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 18,
  },
  apiBannerBold: { fontFamily: Fonts.bold, color: Colors.text },
  showMoreBtn: {
    alignSelf: 'center', marginTop: 8, marginBottom: 16,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  showMoreText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.navy },
  filterChipsRow: { gap: 8, marginBottom: 16 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.navy, borderColor: Colors.navy,
  },
  filterChipText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary,
  },
  filterChipTextActive: { color: Colors.white },
  registerCTA: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: Colors.coral, borderStyle: 'dashed',
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  registerCTAIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.coral}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  orgRegisterCTA: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#C7CBD6', borderStyle: 'dashed',
    borderRadius: 14, padding: 16, marginBottom: 16,
    backgroundColor: Colors.white,
  },
  orgRegisterCTAIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F2F8',
    justifyContent: 'center', alignItems: 'center',
  },
  registerCTAInfo: { flex: 1 },
  registerCTATitle: {
    fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text,
  },
  registerCTASub: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2,
  },
  shareStoryCTA: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: Colors.coral, borderStyle: 'dashed',
    borderRadius: 14, padding: 16, marginBottom: 16,
  },
  shareStoryIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.coral}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  shareStoryInfo: { flex: 1 },
  shareStoryTitle: {
    fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text,
  },
  shareStorySub: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2,
  },
  orgRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#EEF0F4',
  },
  orgInitialTile: {
    width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  orgInitialText: {
    fontSize: 16, fontFamily: INTEREB, fontWeight: '800', color: '#fff',
  },
  orgInfo: { flex: 1, gap: 3 },
  orgNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  orgName: {
    fontSize: 13.5, fontFamily: INTERB, fontWeight: '700', color: '#26265E', flexShrink: 1,
  },
  orgMeta: {
    fontSize: 12, fontFamily: INTER, fontWeight: '400', color: '#6B7280',
  },
  statusPill: {
    alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2,
  },
  statusPillText: {
    fontSize: 10.5, fontFamily: INTERB, fontWeight: '700',
  },
  fosterCard: {
    flexDirection: 'row', gap: 12, backgroundColor: Colors.white, borderRadius: 14,
    padding: 14, marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  fosterPhotoWrap: { width: 64, height: 64, borderRadius: 12, overflow: 'hidden' },
  fosterPhoto: { width: '100%', height: '100%' },
  fosterPhotoFallback: {
    backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center',
  },
  fosterBody: { flex: 1 },
  fosterName: {
    fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text,
  },
  fosterChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6,
  },
  fosterChip: {
    backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border,
  },
  fosterChipText: {
    fontSize: 10, fontFamily: Fonts.semibold, color: Colors.textSecondary,
  },
  fosterBreed: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary,
  },
  fosterNeed: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary,
    lineHeight: 18, marginTop: 4,
  },
  fosterButtons: {
    flexDirection: 'row', gap: 8, marginTop: 10,
  },
  fosterViewBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.surface, alignItems: 'center',
  },
  fosterViewText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.text,
  },
  fosterApplyBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: Colors.coral, alignItems: 'center',
  },
  fosterAppliedBtn: {
    backgroundColor: Colors.teal,
  },
  fosterApplyText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.white,
  },
  storyCard: {
    backgroundColor: Colors.white, borderRadius: 14, marginBottom: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
    position: 'relative',
  },
  storyCardTouchable: { flex: 1 },
  storyImageWrap: {
    position: 'relative', height: 200, backgroundColor: Colors.surface,
  },
  storyImage: { width: '100%', height: '100%' },
  storyImageFallback: { backgroundColor: Colors.navy, justifyContent: 'center', alignItems: 'center' },
  storyTagPill: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4,
  },
  storyTagText: {
    fontSize: 10, fontFamily: Fonts.bold, color: Colors.white, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  storyTitle: {
    fontSize: FontSizes.lg, fontFamily: Fonts.extrabold, color: Colors.text,
    padding: 14, paddingBottom: 6, lineHeight: 22,
  },
  storyAuthorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingBottom: 6,
  },
  storyAuthorAvatar: { width: 20, height: 20, borderRadius: 10 },
  storyAuthorAvatarFallback: { backgroundColor: Colors.coral, justifyContent: 'center', alignItems: 'center' },
  storyAuthorInitial: { fontSize: 9, fontFamily: Fonts.bold, color: Colors.white },
  storyMeta: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, flex: 1,
  },
  storyExcerpt: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary,
    paddingHorizontal: 14, paddingBottom: 14, lineHeight: 18,
  },
  storyMenuBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.85)', justifyContent: 'center', alignItems: 'center',
  },
  menuOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 200 },
  menuSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 12, paddingBottom: 32 },
  menuHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 8 },
  menuItemText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  emptyState: {
    alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, marginTop: 12,
  },
  emptyDesc: {
    fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary,
    textAlign: 'center', marginTop: 8,
  },
  signInBtn: {
    backgroundColor: Colors.coral, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14, marginTop: 16,
  },
  signInBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  providerAvatar: { width: 44, height: 44, borderRadius: 12 },
  bookBtn: {
    alignSelf: 'flex-start', marginTop: 8, backgroundColor: Colors.teal,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  bookBtnTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.white },
});
