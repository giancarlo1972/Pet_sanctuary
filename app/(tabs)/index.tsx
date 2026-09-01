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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import {
  MapPin,
  Clock,
  Plus,
  PawPrint,
  TriangleAlert as AlertTriangle,
  ChevronRight,
  Building2,
  Car,
  Siren,
  HeartHandshake,
  Megaphone,
  Navigation,
  X,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import SignedImage from '@/components/SignedImage';

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
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  lost: 'Lost Pet',
  stray: 'Stray Pet',
  foster: 'Foster Request',
  support: 'Support Request',
  inform: 'Authority Report',
  emergency: 'Emergency',
};

const REPORT_TYPE_ICONS: Record<string, { icon: typeof AlertTriangle }> = {
  lost: { icon: AlertTriangle },
  stray: { icon: AlertTriangle },
  foster: { icon: HeartHandshake },
  support: { icon: HeartHandshake },
  inform: { icon: Megaphone },
  emergency: { icon: Siren },
};

const SEVERITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: Colors.criticalBg, color: Colors.critical, label: 'CRITICAL' },
  urgent: { bg: Colors.urgentBg, color: Colors.urgent, label: 'URGENT' },
  standard: { bg: Colors.standardBg, color: Colors.accentDark, label: 'STANDARD' },
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

interface NearbyReport extends Report {
  distance_km: number;
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
  const [featured, setFeatured] = useState<Pet[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [nearbyAlert, setNearbyAlert] = useState<NearbyReport | null>(null);
  const [nearbyDismissed, setNearbyDismissed] = useState(false);
  const [homeStories, setHomeStories] = useState<HomeStory[]>([]);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);

  const loadFeatured = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('pets')
        .select('id, name, breed, species, main_photo_url, location, status, created_at')
        .eq('is_public', true)
        .neq('availability', 'none')
        .order('created_at', { ascending: false })
        .limit(6);
      setFeatured(data || []);
    } catch { /* ignore */ }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('reports')
        .select('id, report_type, severity, pet_name, location_address, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(3);
      setLiveAlerts(data || []);
    } catch { /* ignore */ }
  }, []);

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
        .limit(3);
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
    await Promise.all([loadFeatured(), loadAlerts(), loadStories()]);
    setLoading(false);
  }, [loadFeatured, loadAlerts, loadStories]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Capture device location once on mount
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
      } catch { /* ignore — proximity alerts need location */ }
    })();
  }, []);

  // Poll nearby reports every 60s — only when authenticated
  const pollFailuresRef = useRef(0);

  useEffect(() => {
    const poll = async () => {
      if (!session) return;
      const loc = locationRef.current;
      if (!loc) return;
      try {
        const { data, error } = await supabase.rpc('nearby_reports', {
          p_lat: loc.lat, p_lng: loc.lng, p_radius_km: 3,
        });
        if (error) {
          pollFailuresRef.current += 1;
          return;
        }
        pollFailuresRef.current = 0;
        if (data && data.length > 0) {
          const top = data[0] as NearbyReport;
          setNearbyAlert(top);
          setNearbyDismissed(false);
        }
      } catch {
        pollFailuresRef.current += 1;
      }
    };
    poll();
    const interval = setInterval(() => {
      if (!session || pollFailuresRef.current >= 2) return;
      poll();
    }, 60000);
    return () => clearInterval(interval);
  }, [session]);

  const renderFeaturedCard = (pet: Pet) => (
    <TouchableOpacity
      key={pet.id}
      style={styles.featuredCard}
      onPress={() => router.push(`/pet-details?id=${pet.id}`)}
      activeOpacity={0.85}
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
  );

  const renderAlertRow = (report: Report) => {
    const sev = report.severity || 'standard';
    const style = SEVERITY_STYLE[sev] || SEVERITY_STYLE.standard;
    const IconDef = REPORT_TYPE_ICONS[report.report_type] || { icon: AlertTriangle };
    const Icon = IconDef.icon;
    return (
      <TouchableOpacity
        key={report.id}
        style={styles.alertRow}
        onPress={() => router.push(`/report-details?id=${report.id}`)}
        activeOpacity={0.85}
      >
        <View style={[styles.alertIconTile, { backgroundColor: style.bg }]}>
          <Icon color={style.color} size={18} />
        </View>
        <View style={styles.alertBody}>
          <Text style={styles.alertTitle} numberOfLines={1}>
            {report.pet_name || report.location_address || 'Report'}
          </Text>
          <Text style={[styles.alertMeta, { color: style.color }]}>
            {REPORT_TYPE_LABELS[report.report_type] || report.report_type} · {style.label}
          </Text>
        </View>
        <Text style={styles.alertTime}>{timeAgo(report.created_at)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <AppHeader title="Home" />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.coral} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Proximity alert banner */}
          {nearbyAlert && !nearbyDismissed && (() => {
            const sev = nearbyAlert.severity || 'standard';
            const sevColor = SEVERITY_STYLE[sev]?.color || Colors.textSecondary;
            return (
              <TouchableOpacity
                style={[styles.proximityBanner, { borderLeftColor: sevColor }]}
                onPress={() => router.push(`/report-details?id=${nearbyAlert.id}`)}
                activeOpacity={0.9}
              >
                <View style={[styles.proximityIcon, { backgroundColor: `${sevColor}20` }]}>
                  <Navigation color={sevColor} size={18} />
                </View>
                <View style={styles.proximityBody}>
                  <Text style={[styles.proximityLabel, { color: sevColor }]}>
                    [{sev.toUpperCase()}] {nearbyAlert.pet_name || REPORT_TYPE_LABELS[nearbyAlert.report_type] || 'Alert'}
                  </Text>
                  <Text style={styles.proximityDesc} numberOfLines={1}>
                    {nearbyAlert.location_address || 'Nearby'} — {nearbyAlert.distance_km.toFixed(1)} km from you
                  </Text>
                </View>
                <TouchableOpacity style={styles.proximityClose} onPress={() => setNearbyDismissed(true)}>
                  <X color={Colors.textTertiary} size={16} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })()}

          {/* Emergency banner */}
          <TouchableOpacity
            style={styles.emergencyBanner}
            onPress={() => router.push('/lost-stray-report')}
            activeOpacity={0.9}
          >
            <View style={styles.emergencyIcon}>
              <AlertTriangle color={Colors.white} size={20} />
            </View>
            <View style={styles.emergencyBody}>
              <Text style={styles.emergencyTitle}>See an animal in danger?</Text>
              <Text style={styles.emergencySub}>Tap here to report it immediately</Text>
            </View>
            <ChevronRight color="#FBD3D0" size={20} />
          </TouchableOpacity>

          {/* Live alerts */}
          {liveAlerts.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Live alerts</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/reports')} activeOpacity={0.7}>
                  <Text style={styles.viewAllLink}>View all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.alertList}>
                {liveAlerts.slice(0, 3).map(renderAlertRow)}
              </View>
            </View>
          )}

          {/* Featured pets */}
          {featured.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Featured pets</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredRow}
              >
                {featured.map(renderFeaturedCard)}
              </ScrollView>
            </View>
          )}

          {/* Rescue stories */}
          {homeStories.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Rescue stories</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/community')} activeOpacity={0.7}>
                  <Text style={styles.viewAllLink}>See all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.storyList}>
                {homeStories.map((s) => {
                  const displayName = s.org_name || s.author_name || 'Rescue Army';
                  const displayAvatar = s.org_logo || s.author_avatar;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={styles.homeStoryCard}
                      onPress={() => router.push(`/story-details?id=${s.id}`)}
                      activeOpacity={0.85}
                    >
                      {s.cover_photo_url ? (
                        <Image source={{ uri: s.cover_photo_url }} style={styles.homeStoryImage} resizeMode="cover" />
                      ) : (
                        <View style={[styles.homeStoryImage, styles.homeStoryImageFallback]}>
                          <PawPrint color={Colors.white} size={24} />
                        </View>
                      )}
                      <View style={styles.homeStoryBody}>
                        <View style={styles.homeStoryTypePill}>
                          <Text style={styles.homeStoryTypeText}>{s.story_type.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.homeStoryTitle} numberOfLines={2}>{s.title}</Text>
                        <View style={styles.homeStoryAuthorRow}>
                          {displayAvatar ? (
                            <Image source={{ uri: displayAvatar }} style={styles.homeStoryAvatar} />
                          ) : (
                            <View style={[styles.homeStoryAvatar, styles.homeStoryAvatarFallback]}>
                              <Text style={styles.homeStoryAvatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
                            </View>
                          )}
                          <Text style={styles.homeStoryAuthorName} numberOfLines={1}>{displayName}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },

  emergencyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.critical, borderRadius: 14, padding: 14, marginBottom: 24,
  },
  proximityBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4,
  },
  proximityIcon: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  proximityBody: { flex: 1 },
  proximityLabel: {
    fontSize: FontSizes.sm, fontFamily: Fonts.bold,
  },
  proximityDesc: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2,
  },
  proximityClose: {
    width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  emergencyIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  emergencyBody: { flex: 1 },
  emergencyTitle: {
    fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.white,
  },
  emergencySub: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: '#FBD3D0', marginTop: 2,
  },

  section: { marginBottom: 28 },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text,
  },
  viewAllLink: {
    fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.coral,
  },

  alertList: { gap: 8 },
  alertRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  alertIconTile: {
    width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
  },
  alertBody: { flex: 1 },
  alertTitle: {
    fontSize: 13.5, fontFamily: Fonts.bold, color: Colors.navy,
  },
  alertMeta: {
    fontSize: FontSizes.sm, fontFamily: Fonts.semibold, marginTop: 2,
  },
  alertTime: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary,
  },

  featuredRow: { gap: 12, paddingRight: 20, paddingBottom: 4 },
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
    fontSize: FontSizes.xl, fontFamily: Fonts.extrabold, color: Colors.white,
  },
  featuredBreed: {
    fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.white, opacity: 0.9,
  },
  featuredLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  featuredLocationText: {
    fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.white, opacity: 0.8, flexShrink: 1,
  },

  storyList: { gap: 12 },
  homeStoryCard: {
    flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  homeStoryImage: { width: 120, height: '100%' },
  homeStoryImageFallback: { backgroundColor: Colors.navy, justifyContent: 'center', alignItems: 'center' },
  homeStoryBody: { flex: 1, padding: 12, gap: 6 },
  homeStoryTypePill: {
    alignSelf: 'flex-start', backgroundColor: Colors.coralBg, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2,
  },
  homeStoryTypeText: { fontSize: 9, fontFamily: Fonts.bold, color: Colors.coral, letterSpacing: 0.5 },
  homeStoryTitle: { fontSize: FontSizes.md, fontFamily: Fonts.extrabold, color: Colors.text, lineHeight: 20 },
  homeStoryAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  homeStoryAvatar: { width: 18, height: 18, borderRadius: 9 },
  homeStoryAvatarFallback: { backgroundColor: Colors.coral, justifyContent: 'center', alignItems: 'center' },
  homeStoryAvatarInitial: { fontSize: 8, fontFamily: Fonts.bold, color: Colors.white },
  homeStoryAuthorName: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, flex: 1 },
});
