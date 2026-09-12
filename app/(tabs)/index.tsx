import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  MapPin,
  PawPrint,
  TriangleAlert as AlertTriangle,
  ChevronRight,
  Car,
  Siren,
  HeartHandshake,
  Megaphone,
  Play,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { loadHelpFlags, loadHelpAlerts, type HelpFlags } from '@/lib/help-alerts';
import { hoursLeft, serviceLabel } from '@/lib/helper-duty';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import SignedImage from '@/components/SignedImage';
import HelpersNearby from '@/components/HelpersNearby';
import { Card } from '@/components/Card';

const FEATURED_WIDTH = 170;
const FEATURED_HEIGHT = 210;

interface Pet {
  id: string;
  name: string;
  breed: string;
  species: string;
  main_photo_url: string | null;
  location: string | null;
  status: string;
  created_at: string;
}

interface Report {
  id: string;
  report_type: string;
  severity: string | null;
  pet_name: string | null;
  location_address: string | null;
  created_at: string;
  distance_km?: number | null;
  user_id?: string | null;
  status?: string | null;
  minePending?: boolean;
}

interface CommunityNeed {
  id: string;
  title: string;
  body: string | null;
  need_type: string;
  created_at: string;
  org_id?: string | null;
}

const MOCK_NEEDS: CommunityNeed[] = [
  {
    id: 'seed-ride',
    title: 'Happy Paws needs a ride: 2 cats to Hudson Vet Clinic',
    body: '3.1 mi · Brooklyn → Manhattan',
    need_type: 'ride',
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-supplies',
    title: 'Second Chance Sanctuary is low on kitten formula',
    body: '4 of 12 cans donated',
    need_type: 'supplies',
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
];

interface DutyStatus {
  on: boolean;
  hours: number;
  services: string[];
  radius_mi: number;
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  lost: 'Lost pet',
  stray: 'Found stray',
  foster: 'Foster request',
  support: 'Support request',
  inform: 'Authority report',
  emergency: 'Emergency',
  injured: 'Injured animal',
  road_accident: 'Road accident',
  cruelty: 'Cruelty/Neglect',
  lost_found: 'Lost or found',
};

const REPORT_TYPE_ICONS: Record<string, { icon: typeof AlertTriangle }> = {
  lost: { icon: AlertTriangle },
  stray: { icon: AlertTriangle },
  foster: { icon: HeartHandshake },
  support: { icon: HeartHandshake },
  inform: { icon: Megaphone },
  emergency: { icon: Siren },
  injured: { icon: AlertTriangle },
  road_accident: { icon: Car },
  cruelty: { icon: AlertTriangle },
  lost_found: { icon: AlertTriangle },
};

const SEVERITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: Colors.criticalBg, color: Colors.critical, label: 'CRITICAL' },
  urgent: { bg: Colors.urgentBg, color: Colors.urgent, label: 'URGENT' },
  standard: { bg: Colors.standardBg, color: Colors.accentDark, label: 'STANDARD' },
};

const NEED_TONE: Record<string, { bg: string; color: string }> = {
  'RIDE NEEDED': { bg: Colors.urgentBg, color: Colors.urgent },
  SUPPLIES: { bg: Colors.tealBg, color: Colors.tealDark },
  'FOSTER SURGE': { bg: Colors.standardBg, color: Colors.accentDark },
  VOLUNTEERS: { bg: Colors.navy, color: Colors.white },
};

function timeAgo(dateString: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function looksLikeCoords(value: string | null | undefined): boolean {
  const t = (value || '').trim();
  if (!t) return true;
  if (/current location/i.test(t)) return true;
  if (/^-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+$/.test(t)) return true;
  if (!/[A-Za-z]/.test(t) && /-?\d+\.\d{2,}/.test(t)) return true;
  return false;
}

function neighborhood(addr: string | null | undefined): string {
  if (!addr || looksLikeCoords(addr)) return '';
  const cleaned = addr.replace(/^Current location[^\n,]*/i, '').replace(/^[,;\s]+/, '').trim();
  if (!cleaned || looksLikeCoords(cleaned)) return '';
  const parts = cleaned.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) {
    const city = /^\d/.test(parts[0]) ? parts[1] : parts[0];
    return looksLikeCoords(city) ? '' : city;
  }
  return cleaned.replace(/^\d+\s+/, '');
}

function alertTitle(report: Report): string {
  const name = (report.pet_name || '').trim();
  if (name && !looksLikeCoords(name)) return name;
  const type = REPORT_TYPE_LABELS[report.report_type] || 'Report';
  const hood = neighborhood(report.location_address);
  if (hood) return `${type} near ${hood}`;
  return type;
}

function formatMiFromYou(km: number | null | undefined): string | null {
  if (km == null || !Number.isFinite(km)) return null;
  const mi = km * 0.621371;
  if (mi < 0.15) return '0.1 mi from you';
  if (mi < 10) return `${mi.toFixed(1)} mi from you`;
  return `${Math.round(mi)} mi from you`;
}

function normalizeNeed(type: string): string {
  const k = (type || '').toUpperCase().replace(/[_-]+/g, ' ').trim();
  if (/RIDE|TRANSPORT/.test(k)) return 'RIDE NEEDED';
  if (/SUPPL/.test(k)) return 'SUPPLIES';
  if (/FOSTER/.test(k)) return 'FOSTER SURGE';
  if (/VOLUN/.test(k)) return 'VOLUNTEERS';
  return k || 'NEED';
}

function compactAgo(dateString: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function needCta(type: string, orgId?: string | null): { label: string; href: string } {
  const t = normalizeNeed(type);
  if (t === 'RIDE NEEDED') {
    if (orgId) return { label: 'Offer ride', href: `/organization-details?id=${orgId}` };
    return { label: 'Offer ride', href: '/(tabs)/community' };
  }
  if (t === 'SUPPLIES') return { label: 'Donate', href: '/(tabs)/reports?tab=fund' };
  if (t === 'FOSTER SURGE') return { label: 'Apply', href: '/(tabs)/community?seg=fosters' };
  if (t === 'VOLUNTEERS') return { label: 'Join', href: '/(tabs)/community' };
  return { label: 'Help', href: '/(tabs)/community' };
}

interface HomeStory {
  id: string;
  title: string;
  cover_photo_url: string | null;
  story_type: string;
  published_at: string | null;
  created_at: string;
  author_name: string | null;
  org_name: string | null;
  org_logo: string | null;
  author_avatar: string | null;
}

export default function HomeScreen() {
  const { user, session } = useAuth();
  const [loginToast, setLoginToast] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof sessionStorage !== 'undefined') {
      const t = sessionStorage.getItem('ra_login_toast');
      if (t) { sessionStorage.removeItem('ra_login_toast'); setLoginToast(t); }
    }
  }, []);
  const [featured, setFeatured] = useState<Pet[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<Report[]>([]);
  const [needs, setNeeds] = useState<CommunityNeed[]>([]);
  const [helpFlags, setHelpFlags] = useState<HelpFlags | null>(null);
  const [duty, setDuty] = useState<DutyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [homeStories, setHomeStories] = useState<HomeStory[]>([]);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);

  const loadFeatured = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('pets')
        .select('id, name, breed, species, main_photo_url, location, status, created_at')
        .eq('listing_type', 'adoptable')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(6);
      setFeatured(data || []);
    } catch { /* ignore */ }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      let flags: HelpFlags | null = null;
      if (user?.id) flags = await loadHelpFlags(user.id);
      setHelpFlags(flags);
      const mapRow = (r: any): Report => ({
        id: r.id,
        report_type: r.report_type,
        severity: r.severity,
        pet_name: r.pet_name,
        location_address: r.location_address,
        created_at: r.created_at,
        user_id: r.user_id ?? null,
        status: r.status ?? null,
        minePending: Boolean(
          user?.id && r.user_id === user.id
          && (r.status === 'pending_moderation' || r.status === 'pending'),
        ),
      });
      let live: Report[] = [];
      const first = await supabase
        .from('reports')
        .select('id, report_type, severity, pet_name, location_address, created_at, user_id, status')
        .in('status', ['active', 'open'])
        .order('created_at', { ascending: false })
        .limit(2);
      if (first.error) {
        const retry = await supabase
          .from('reports')
          .select('id, report_type, severity, pet_name, location_address, created_at')
          .in('status', ['active', 'open'])
          .order('created_at', { ascending: false })
          .limit(2);
        live = (retry.data || []).map(mapRow);
      } else {
        live = (first.data || []).map(mapRow);
      }
      if (user?.id) {
        try {
          const own = await supabase
            .from('reports')
            .select('id, report_type, severity, pet_name, location_address, created_at, user_id, status')
            .eq('user_id', user.id)
            .in('status', ['pending_moderation', 'pending'])
            .order('created_at', { ascending: false })
            .limit(2);
          const pending = (own.data || []).map(mapRow);
          const seen = new Set<string>();
          const merged: Report[] = [];
          for (const r of [...pending, ...live]) {
            if (seen.has(r.id)) continue;
            seen.add(r.id);
            merged.push(r);
            if (merged.length >= 3) break;
          }
          live = merged;
        } catch { /* own pending is optional */ }
      }
      const loc = locationRef.current;
      if (loc && user?.id && live.length) {
        try {
          const near = await loadHelpAlerts({ lat: loc.lat, lng: loc.lng, flags, limit: 50 });
          const dist: Record<string, number> = {};
          for (const n of near || []) {
            if (n?.id && n.distance_km != null) dist[n.id] = Number(n.distance_km);
          }
          for (const r of live) {
            if (dist[r.id] != null) r.distance_km = dist[r.id];
          }
        } catch { /* proximity chip is optional */ }
      }
      setLiveAlerts(live);
    } catch { /* ignore */ }
  }, [user?.id]);

  const loadNeeds = useCallback(async () => {
    try {
      let { data, error } = await supabase
        .from('community_needs')
        .select('id, title, body, need_type, created_at, org_id')
        .in('status', ['open', 'pinned'])
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) {
        const retry = await supabase
          .from('community_needs')
          .select('id, title, body, need_type, created_at')
          .in('status', ['open', 'pinned'])
          .order('created_at', { ascending: false })
          .limit(8);
        data = retry.data as typeof data;
        error = retry.error;
      }
      const rows = (!error && data ? data : []) as CommunityNeed[];
      setNeeds(rows.length ? rows : MOCK_NEEDS);
    } catch {
      setNeeds(MOCK_NEEDS);
    }
  }, []);

  const loadDuty = useCallback(async () => {
    if (!user?.id) { setDuty(null); return; }
    try {
      const { data } = await supabase
        .from('helper_status')
        .select('on_duty, until_at, services, radius_mi')
        .eq('user_id', user.id)
        .maybeSingle();
      const hours = hoursLeft(data?.until_at || null);
      const on = Boolean(data?.on_duty) && hours > 0;
      setDuty({
        on,
        hours,
        services: (data?.services || []) as string[],
        radius_mi: Number(data?.radius_mi) || 5,
      });
    } catch {
      setDuty(null);
    }
  }, [user?.id]);

  const loadStories = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('stories')
        .select(`
          id, title, cover_photo_url, story_type, published_at, created_at,
          profiles!inner(full_name, avatar_url),
          organizations(name, logo_url)
        `)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(6);
      if (data) {
        setHomeStories(data.map((s: any) => ({
          id: s.id,
          title: s.title,
          cover_photo_url: s.cover_photo_url,
          story_type: s.story_type,
          published_at: s.published_at,
          created_at: s.created_at,
          author_name: s.profiles?.full_name || null,
          author_avatar: s.profiles?.avatar_url || null,
          org_name: s.organizations?.name || null,
          org_logo: s.organizations?.logo_url || null,
        })));
      }
    } catch { /* ignore */ }
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadFeatured(), loadAlerts(), loadNeeds(), loadDuty(), loadStories()]);
    setLoading(false);
  }, [loadFeatured, loadAlerts, loadNeeds, loadDuty, loadStories]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    (async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000 });
          } else {
            reject(new Error('no geolocation'));
          }
        });
        locationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        loadAlerts();
      } catch { /* proximity chips need location */ }
    })();
  }, [loadAlerts]);

  const renderFeaturedCard = (pet: Pet) => (
    <Card key={pet.id} padded={false} style={styles.featuredCard}>
      <TouchableOpacity
        onPress={() => router.push(`/pet-details?id=${pet.id}`)}
        activeOpacity={0.85}
        style={{ flex: 1 }}
      >
        <SignedImage path={pet.main_photo_url} style={styles.featuredImage} />
        <LinearGradient
          colors={['transparent', 'rgba(10,10,40,0.78)']}
          style={styles.featuredGradient}
        >
          <View style={styles.featuredInfo}>
            <Text style={styles.featuredName} numberOfLines={1}>{pet.name}</Text>
            <Text style={styles.featuredBreed} numberOfLines={1}>{pet.breed}</Text>
            {pet.location ? (
              <View style={styles.featuredLocation}>
                <MapPin color={Colors.white} size={11} />
                <Text style={styles.featuredLocationText} numberOfLines={1}>{pet.location}</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Card>
  );

  const renderAlertRow = (report: Report) => {
    const sev = report.severity || 'standard';
    const style = SEVERITY_STYLE[sev] || SEVERITY_STYLE.standard;
    const IconDef = REPORT_TYPE_ICONS[report.report_type] || { icon: AlertTriangle };
    const Icon = IconDef.icon;
    const mi = formatMiFromYou(report.distance_km);
    return (
      <Card key={report.id} padded={false}>
        <TouchableOpacity
          style={styles.alertRow}
          onPress={() => router.push(`/report-details?id=${report.id}`)}
          activeOpacity={0.85}
        >
          <View style={[styles.alertIconTile, { backgroundColor: style.bg }]}>
            <Icon color={style.color} size={18} />
          </View>
          <View style={styles.alertBody}>
            <Text style={styles.alertTitle} numberOfLines={1}>{alertTitle(report)}</Text>
            <Text style={[styles.alertMeta, { color: style.color }]}>
              {REPORT_TYPE_LABELS[report.report_type] || report.report_type} · {style.label}
            </Text>
            {report.minePending ? (
              <View style={[styles.miChip, { backgroundColor: Colors.standardBg }]}>
                <Text style={[styles.miChipText, { color: Colors.accentDark }]}>Your report · Pending</Text>
              </View>
            ) : mi ? (
              <View style={styles.miChip}>
                <Text style={styles.miChipText}>{mi}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.alertTime}>{timeAgo(report.created_at)}</Text>
        </TouchableOpacity>
      </Card>
    );
  };

  const dutyActive = Boolean(duty?.on);
  const flagsActive = Boolean(helpFlags?.volunteer_active || helpFlags?.responder_active);
  const flagLabel = helpFlags?.volunteer_active && helpFlags?.responder_active
    ? 'volunteer & responder'
    : helpFlags?.responder_active
      ? 'responder'
      : 'volunteer';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <AppHeader title="Home" maxWidth={1080} />
      <Page wideMax={1080}>
      {loginToast ? (
        <TouchableOpacity style={styles.loginToast} onPress={() => { setLoginToast(null); router.push('/(tabs)/profile'); }} activeOpacity={0.9}>
          <Text style={styles.loginToastTxt}>Signed in as {loginToast}. Admin console is under Me.</Text>
          <Text style={styles.loginToastLink}>Open Me →</Text>
        </TouchableOpacity>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.coral} />
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={styles.emergencyBanner}
            onPress={() => router.push('/report')}
            activeOpacity={0.9}
          >
            <View style={styles.emergencyIcon}>
              <AlertTriangle color={Colors.white} size={20} />
            </View>
            <View style={styles.emergencyBody}>
              <Text style={styles.emergencyTitle}>See an animal in danger?</Text>
              <Text style={styles.emergencySub}>Report it — nearby responders are alerted instantly</Text>
            </View>
            <ChevronRight color="#FBD3D0" size={20} />
          </TouchableOpacity>

          {dutyActive ? (
            <TouchableOpacity
              style={styles.dutyStrip}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.85}
            >
              <View style={styles.dutyDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dutyKicker}>ON DUTY</Text>
                <Text style={styles.dutyText}>
                  {Math.max(1, Math.round(duty!.hours))} h left
                  {duty!.services.length ? ` · ${duty!.services.slice(0, 3).map(serviceLabel).join(' · ')}` : ''}
                  {` · ${duty!.radius_mi} mi`}
                </Text>
              </View>
              <ChevronRight color={Colors.tealDark} size={18} />
            </TouchableOpacity>
          ) : flagsActive ? (
            <TouchableOpacity
              style={styles.dutyStrip}
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.85}
            >
              <View style={styles.dutyDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dutyKicker}>ALERTS ON</Text>
                <Text style={styles.dutyText}>
                  {flagLabel} · {helpFlags?.alert_radius_mi || 5} mi
                </Text>
              </View>
              <ChevronRight color={Colors.tealDark} size={18} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Live alerts</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/reports')} activeOpacity={0.7}>
                <Text style={styles.viewAllLink}>View all</Text>
              </TouchableOpacity>
            </View>
            {liveAlerts.length > 0 ? (
              <View style={styles.alertList}>
                {liveAlerts.map(renderAlertRow)}
              </View>
            ) : (
              <Text style={styles.emptyLine}>No live alerts yet. Be the first to report.</Text>
            )}
          </View>

          {needs.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trending now</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.needRow}
              >
                {needs.map((n) => {
                  const tag = normalizeNeed(n.need_type);
                  const tone = NEED_TONE[tag] || { bg: Colors.surface, color: Colors.navy };
                  const cta = needCta(n.need_type, n.org_id);
                  return (
                    <View key={n.id} style={styles.needCard}>
                      <View style={styles.needTop}>
                        <View style={[styles.needTag, { backgroundColor: tone.bg }]}>
                          <Text style={[styles.needTagText, { color: tone.color }]}>{tag}</Text>
                        </View>
                        <Text style={styles.needTime}>{compactAgo(n.created_at)}</Text>
                      </View>
                      <Text style={styles.needTitle} numberOfLines={3}>{n.title}</Text>
                      <View style={styles.needFooter}>
                        {n.body ? <Text style={styles.needMeta} numberOfLines={2}>{n.body}</Text> : <View style={{ flex: 1 }} />}
                        <TouchableOpacity onPress={() => router.push(cta.href as any)} activeOpacity={0.8}>
                          <Text style={styles.needCta}>{cta.label} →</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {session ? (
            <View style={styles.section}>
              <HelpersNearby userId={user?.id || null} />
            </View>
          ) : null}

          {featured.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Featured pets</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/pets')} activeOpacity={0.7}>
                  <Text style={styles.viewAllLink}>See all</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredRow}
              >
                {featured.map(renderFeaturedCard)}
              </ScrollView>
            </View>
          ) : null}

          {homeStories.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Rescue stories</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/community')} activeOpacity={0.7}>
                  <Text style={styles.viewAllLink}>See all</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storyRow}
              >
                {homeStories.map((s) => {
                  const displayName = s.org_name || s.author_name || 'Rescue Army';
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.storyCard}
                      onPress={() => router.push(`/story-details?id=${s.id}`)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.storyImageWrap}>
                        {s.cover_photo_url ? (
                          <Image source={{ uri: s.cover_photo_url }} style={styles.storyImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.storyImage, styles.storyImageFallback]}>
                            <PawPrint color={Colors.white} size={24} />
                          </View>
                        )}
                        <View style={styles.storyTag}>
                          <Text style={styles.storyTagText}>{(s.story_type || 'rescue').toUpperCase()}</Text>
                        </View>
                        <View style={styles.storyPlay}>
                          <Play size={12} color={Colors.navy} fill={Colors.navy} />
                        </View>
                      </View>
                      <View style={styles.storyBody}>
                        <Text style={styles.storyTitle} numberOfLines={2}>{s.title}</Text>
                        <Text style={styles.storyMeta} numberOfLines={1}>{displayName}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
      </Page>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loginToast: {
    backgroundColor: Colors.navy, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  },
  loginToastTxt: { flex: 1, color: Colors.white, fontFamily: Fonts.medium, fontSize: FontSizes.sm },
  loginToastLink: { color: '#FBD3D0', fontFamily: Fonts.bold, fontSize: FontSizes.sm },
  container: { flex: 1, backgroundColor: Colors.screen },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },

  emergencyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.coral, borderRadius: 14, padding: 14,
  },
  emergencyIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  emergencyBody: { flex: 1 },
  emergencyTitle: {
    fontSize: 14, fontFamily: Fonts.bold, color: Colors.white,
  },
  emergencySub: {
    fontSize: 12, fontFamily: Fonts.regular, color: '#FBD3D0', marginTop: 2,
  },

  dutyStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.tealBg, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#C8E6E2',
  },
  dutyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.teal },
  dutyKicker: { fontSize: 10, fontFamily: Fonts.extrabold, color: Colors.tealDark, letterSpacing: 0.8 },
  dutyText: { fontSize: 12, fontFamily: Fonts.semibold, color: Colors.navy, marginTop: 2 },

  section: { gap: 12 },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17, fontFamily: Fonts.bold, color: Colors.text,
  },
  viewAllLink: {
    fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.coral,
  },
  emptyLine: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },

  alertList: { gap: 8 },
  alertRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14,
  },
  alertIconTile: {
    width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  alertBody: { flex: 1, gap: 2 },
  alertTitle: {
    fontSize: 13.5, fontFamily: Fonts.bold, color: Colors.navy,
  },
  alertMeta: {
    fontSize: 11, fontFamily: Fonts.semibold,
  },
  alertTime: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.textTertiary,
  },
  miChip: {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  miChipText: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.navy },

  needRow: { gap: 12, paddingRight: 8 },
  needCard: {
    width: 200, borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.white, padding: 12, gap: 8,
  },
  needTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  needTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  needTagText: { fontSize: 10, fontFamily: Fonts.bold, fontWeight: '700', letterSpacing: 0.2 },
  needTime: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textTertiary },
  needTitle: { fontSize: 13, fontFamily: Fonts.bold, fontWeight: '700', color: Colors.navy, lineHeight: 18 },
  needFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 'auto' as const },
  needMeta: { flex: 1, fontSize: 11.5, fontFamily: Fonts.regular, color: Colors.textSecondary },
  needCta: { fontSize: 12, fontFamily: Fonts.bold, fontWeight: '700', color: Colors.coral },

  featuredRow: { gap: 12, paddingRight: 8 },
  featuredCard: {
    width: FEATURED_WIDTH, height: FEATURED_HEIGHT, borderRadius: 16,
    overflow: 'hidden', backgroundColor: Colors.surface,
  },
  featuredImage: { width: '100%', height: '100%' },
  featuredGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '55%', justifyContent: 'flex-end', padding: 12,
  },
  featuredInfo: { gap: 2 },
  featuredName: {
    fontSize: 16, fontFamily: Fonts.extrabold, color: Colors.white,
  },
  featuredBreed: {
    fontSize: 12, fontFamily: Fonts.regular, color: Colors.white, opacity: 0.9,
  },
  featuredLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  featuredLocationText: {
    fontSize: 11, fontFamily: Fonts.regular, color: Colors.white, opacity: 0.8, flexShrink: 1,
  },

  storyRow: { gap: 12, paddingRight: 8 },
  storyCard: {
    width: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.border,
  },
  storyImageWrap: { height: 120, position: 'relative' },
  storyImage: { width: '100%', height: 120 },
  storyImageFallback: { backgroundColor: Colors.navy, justifyContent: 'center', alignItems: 'center' },
  storyTag: {
    position: 'absolute', left: 8, top: 8,
    backgroundColor: 'rgba(10,10,40,0.7)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  storyTagText: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.white, letterSpacing: 0.3 },
  storyPlay: {
    position: 'absolute', right: 8, bottom: 8,
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  storyBody: { padding: 10, gap: 4 },
  storyTitle: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.navy, lineHeight: 18 },
  storyMeta: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
