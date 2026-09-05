import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
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
} from 'lucide-react-native';
import { InlineBanner } from '@/components/InlineBanner';
import { ConfirmDialog, type ConfirmConfig } from '@/components/ConfirmDialog';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import SignedImage from '@/components/SignedImage';
import type { Story } from '@/types';

type Segment = 'orgs' | 'fosters' | 'stories';

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

const TYPE_FILTERS = ['All', 'Shelters', 'Rescue groups', 'Clinics', 'Sponsors'] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

const FILTER_TO_SECTION: Record<TypeFilter, string> = {
  All: 'all',
  Shelters: 'shelter',
  'Rescue groups': 'rescue',
  Clinics: 'clinic',
  Sponsors: 'sponsor',
};

const ORG_TYPE_ALIASES: Record<string, string> = {
  rescue_group: 'rescue',
  rescue: 'rescue',
  animal_shelter: 'shelter',
  shelter: 'shelter',
  veterinary_clinic: 'clinic',
  clinic: 'clinic',
  sponsor: 'sponsor',
  business: 'sponsor',
};

const ORG_TYPE_LABELS: Record<string, string> = {
  shelter: 'Shelter',
  rescue: 'Rescue group',
  clinic: 'Clinic',
  sponsor: 'Sponsor',
};

const BRAND_COLORS = [Colors.coral, Colors.teal, Colors.navy, Colors.accent, Colors.coralDark, Colors.tealDark];

const STORY_TYPE_LABELS: Record<string, string> = {
  adoption: 'Adoption',
  foster: 'Foster',
  rescue: 'Rescue',
  reunion: 'Reunion',
  memorial: 'Memorial',
  update: 'Update',
};

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return BRAND_COLORS[hash % BRAND_COLORS.length];
}

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

export default function CommunityScreen() {
  const { user } = useAuth();
  const [activeSegment, setActiveSegment] = useState<Segment>('orgs');
  const [orgQuery, setOrgQuery] = useState('');
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [fosterPets, setFosterPets] = useState<FosterPet[]>([]);
  const [fostersLoading, setFostersLoading] = useState(false);
  const [appliedFosters, setAppliedFosters] = useState<Set<string>>(new Set());
  const [stories, setStories] = useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [menuStoryId, setMenuStoryId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);

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

  const loadOrgs = useCallback(async () => {
    try {
      let local: OrgRow[] = [];
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, org_type, location, logo_url, description, status, ein_verified, tax_deductible')
        .eq('status', 'approved')
        .order('name');
      if (!error && data) local = data as OrgRow[];

      let remote: OrgRow[] = [];
      try {
        const resp = await fetch('/api/rescuegroups?state=NY');
        if (resp.ok) {
          const json = await resp.json();
          remote = (json.orgs || []) as OrgRow[];
        }
      } catch { /* ignore */ }

      const seen = new Set(local.map((o) => o.name.toLowerCase()));
      setOrgs([...local, ...remote.filter((o) => !seen.has(o.name.toLowerCase()))]);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
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

  useEffect(() => { loadOrgs(); loadFosters(); loadStories(); }, [loadOrgs, loadFosters, loadStories]);
  useFocusEffect(useCallback(() => { loadOrgs(); loadFosters(); loadStories(); }, [loadOrgs, loadFosters, loadStories]));

  const getSection = (org: OrgRow) => {
    const raw = (org.org_type || 'shelter').toLowerCase();
    return ORG_TYPE_ALIASES[raw] || 'shelter';
  };

  const filteredOrgs = (typeFilter === 'All' ? orgs : orgs.filter((o) => getSection(o) === FILTER_TO_SECTION[typeFilter]))
    .filter((o) => {
      const q = orgQuery.trim().toLowerCase();
      if (!q) return true;
      return o.name.toLowerCase().includes(q) || (o.location || '').toLowerCase().includes(q);
    });

  const getStatusPill = (org: OrgRow) => {
    const s = org.status || 'approved';
    if (s === 'approved' && org.ein_verified) return { label: '501(c)(3) verified', bg: Colors.tealBg, color: Colors.tealDark };
    if (s === 'approved' && !org.ein_verified) return { label: 'Registered', bg: Colors.surface, color: Colors.textSecondary };
    if (s === 'care_partner') return { label: 'Care Fund partner', bg: Colors.standardBg, color: Colors.accentDark };
    return { label: 'Verification pending', bg: Colors.surface, color: Colors.textSecondary };
  };

  const renderOrgRow = (org: OrgRow) => {
    const pill = getStatusPill(org);
    const brandColor = colorForName(org.name);
    return (
      <TouchableOpacity
        key={org.id}
        style={styles.orgRow}
        onPress={() => router.push(`/organization-details?id=${org.id}`)}
        activeOpacity={0.85}
      >
        <View style={[styles.orgInitialTile, { backgroundColor: brandColor }]}>
          <Text style={styles.orgInitialText}>{org.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.orgInfo}>
          <View style={styles.orgNameRow}>
            <Text style={styles.orgName} numberOfLines={1}>{org.name}</Text>
            {org.ein_verified && <ShieldCheck color={Colors.teal} size={15} />}
          </View>
          <Text style={styles.orgMeta} numberOfLines={1}>
            {ORG_TYPE_LABELS[getSection(org)] || 'Organization'}{org.location ? ` · ${org.location}` : ''}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.statusPillText, { color: pill.color }]}>{pill.label}</Text>
          </View>
        </View>
        <ChevronRight color={Colors.textTertiary} size={18} />
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
      <View style={styles.segmentContainer}>
        {(['orgs', 'fosters', 'stories'] as Segment[]).map((seg) => (
          <TouchableOpacity
            key={seg}
            style={[styles.segment, activeSegment === seg && styles.segmentActive]}
            onPress={() => setActiveSegment(seg)}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentText, activeSegment === seg && styles.segmentTextActive]}>
              {seg === 'orgs' ? 'Orgs' : seg === 'fosters' ? 'Fosters' : 'Stories'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.coral} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              loadOrgs();
              loadStories();
            }} />
          }
        >
          {activeSegment === 'orgs' && (
            <>
              <View style={styles.apiBanner}>
                <View style={styles.apiDot} />
                <Text style={styles.apiBannerText}>
                  <Text style={styles.apiBannerBold}>Connected to RescueGroups.org API</Text>
                  {' — '}{filteredOrgs.length} of {orgs.length} organizations
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
                style={styles.registerCTA}
                onPress={() => router.push('/register-organization')}
                activeOpacity={0.85}
              >
                <View style={styles.registerCTAIcon}>
                  <Plus color={Colors.coral} size={20} />
                </View>
                <View style={styles.registerCTAInfo}>
                  <Text style={styles.registerCTATitle}>Register your organization</Text>
                  <Text style={styles.registerCTASub}>Register now · verify your 501(c)(3) status later to unlock tax-deductible donations</Text>
                </View>
                <ChevronRight color={Colors.coral} size={18} />
              </TouchableOpacity>
              {filteredOrgs.length === 0 ? (
                <View style={styles.emptyState}>
                  <Building2 color={Colors.textTertiary} size={40} />
                  <Text style={styles.emptyTitle}>No organizations found</Text>
                  <Text style={styles.emptyDesc}>Try a different search or filter.</Text>
                </View>
              ) : (
                filteredOrgs.map(renderOrgRow)
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
        </ScrollView>
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
    paddingVertical: 10,
    borderRadius: 999,
  },
  segmentActive: { backgroundColor: Colors.navy },
  segmentText: {
    fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary,
  },
  segmentTextActive: { color: Colors.white },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  apiBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 16,
  },
  apiDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.teal,
  },
  apiBannerText: {
    flex: 1, fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 18,
  },
  apiBannerBold: { fontFamily: Fonts.bold, color: Colors.text },
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
    backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  orgInitialTile: {
    width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  orgInitialText: {
    fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.white,
  },
  orgInfo: { flex: 1, gap: 3 },
  orgNameRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  orgName: {
    fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text, flexShrink: 1,
  },
  orgMeta: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary,
  },
  statusPill: {
    alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2,
  },
  statusPillText: {
    fontSize: 10, fontFamily: Fonts.bold,
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
});
