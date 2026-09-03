import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Share,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  MoreVertical,
  MapPin,
  Clock,
  Phone,
  Mail,
  Share as ShareIcon,
  PawPrint,
  TriangleAlert as AlertTriangle,
  Siren,
  HeartHandshake,
  Megaphone,
  Car,
  Sparkles,
  Navigation,
  ShieldAlert,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import SignedImage from '@/components/SignedImage';
import { InlineBanner } from '@/components/InlineBanner';

interface ReportDetail {
  id: string;
  report_type: string;
  urgency: string;
  incident_category: string | null;
  pet_name: string | null;
  pet_type: string | null;
  breed: string | null;
  description: string;
  location_address: string;
  latitude: number | null;
  longitude: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  photo_urls: string[] | null;
  photo_url: string | null;
  status: string;
  severity: string | null;
  created_at: string;
  last_seen_at: string | null;
  colors: string[] | null;
  life_stage: string | null;
  size: string | null;
  gender: string | null;
  animal_kind: string | null;
  allow_direct_contact: boolean;
  approximate_public: boolean;
  ai_summary: string | null;
  ai_species: string | null;
  ai_breed: string | null;
  ai_colors: string[] | null;
  ai_coat: string | null;
  ai_confidence: number | null;
  ai_priority: string | null;
  ai_risk_tags: string[] | null;
  ai_age_range: string | null;
  ai_analyzed_at: string | null;
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

const REPORT_TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  lost: AlertTriangle,
  stray: AlertTriangle,
  foster: HeartHandshake,
  support: HeartHandshake,
  inform: Megaphone,
  emergency: Siren,
  road_accident: Car,
  injured: AlertTriangle,
  lost_found: AlertTriangle,
  cruelty: ShieldAlert,
};

const SEVERITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: Colors.criticalBg, color: Colors.critical, label: 'CRITICAL' },
  urgent: { bg: Colors.urgentBg, color: Colors.urgent, label: 'URGENT' },
  standard: { bg: Colors.standardBg, color: Colors.accentDark, label: 'STANDARD' },
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: Colors.coralBg, color: Colors.coral, label: 'Active' },
  resolved: { bg: Colors.tealBg, color: Colors.teal, label: 'Resolved' },
  closed: { bg: Colors.surface, color: Colors.textSecondary, label: 'Closed' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateTime(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h12}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
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
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ReportDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  useEffect(() => {
    loadReport();
  }, [id]);

  const loadReport = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('reports')
        .select(`
          id, report_type, urgency, incident_category, pet_name, pet_type, breed,
          description, location_address, latitude, longitude,
          contact_name, contact_phone, contact_email,
          photo_urls, photo_url, status, severity, created_at, last_seen_at,
          colors, life_stage, size, gender, animal_kind,
          allow_direct_contact, approximate_public,
          ai_summary, ai_species, ai_breed, ai_colors, ai_coat, ai_confidence,
          ai_priority, ai_risk_tags, ai_age_range, ai_analyzed_at
        `)
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        console.error('[report-details] query failed:', fetchError.message);
        setError('We could not load this report.');
      } else if (!data) {
        setError('This report could not be found. It may have been removed.');
      } else {
        setReport(data);
      }
    } catch (err) {
      console.error('[report-details] load failed:', err);
      setError('We could not load this report.');
    }
    setLoading(false);
  };

  const handleShare = async () => {
    if (!report) return;
    try {
      await Share.share({
        message: `${REPORT_TYPE_LABELS[report.report_type] || report.report_type}: ${report.pet_name || report.location_address}\n\n${report.description}\n\nLocation: ${report.location_address}`,
      });
    } catch { /* ignore */ }
  };

  const openMaps = () => {
    if (!report) return;
    const lat = report.latitude;
    const lng = report.longitude;
    if (lat != null && lng != null) {
      const url = `https://www.google.com/maps?q=${lat},${lng}`;
      Linking.openURL(url).catch(() => {
        setBanner({ message: 'Could not open maps.', kind: 'error' });
      });
    }
  };

  const callPhone = () => {
    if (!report?.contact_phone) return;
    Linking.openURL(`tel:${report.contact_phone}`).catch(() => {
      setBanner({ message: 'Could not open phone app.', kind: 'error' });
    });
  };

  const sendEmail = () => {
    if (!report?.contact_email) return;
    Linking.openURL(`mailto:${report.contact_email}`).catch(() => {
      setBanner({ message: 'Could not open email app.', kind: 'error' });
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.coral} />
      </SafeAreaView>
    );
  }

  if (error || !report) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.errorTitle}>{error || 'Report not found'}</Text>
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.errorBackText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sev = report.severity || 'standard';
  const sevStyle = SEVERITY_STYLE[sev] || SEVERITY_STYLE.standard;
  const statusStyle = STATUS_STYLE[report.status] || STATUS_STYLE.active;
  const Icon = REPORT_TYPE_ICONS[report.report_type] || AlertTriangle;
  const typeLabel = REPORT_TYPE_LABELS[report.report_type] || report.report_type;

  const photos: string[] = [
    ...(report.photo_urls || []),
    ...(report.photo_url ? [report.photo_url] : []),
  ].filter(Boolean);
  const uniquePhotos = [...new Set(photos)];

  const aiFields = [
    report.ai_species && { label: 'Species', value: report.ai_species },
    report.ai_breed && { label: 'Breed guess', value: report.ai_breed },
    report.ai_age_range && { label: 'Age range', value: report.ai_age_range },
    report.ai_colors && report.ai_colors.length > 0 && { label: 'Colors', value: report.ai_colors.join(', ') },
    report.ai_coat && { label: 'Coat', value: report.ai_coat },
    report.ai_confidence != null && { label: 'Confidence', value: `${Math.round(Number(report.ai_confidence) * 100)}%` },
  ].filter(Boolean);

  const physicalFields = [
    report.animal_kind && { label: 'Animal', value: report.animal_kind },
    report.breed && { label: 'Breed', value: report.breed },
    report.gender && { label: 'Gender', value: report.gender },
    report.life_stage && { label: 'Life stage', value: report.life_stage },
    report.size && { label: 'Size', value: report.size },
    report.colors && report.colors.length > 0 && { label: 'Colors', value: report.colors.join(', ') },
  ].filter(Boolean);

  const riskTags = report.ai_risk_tags || [];
  const aiDone = report.ai_analyzed_at != null;
  const canContact = report.allow_direct_contact && (report.contact_phone || report.contact_email);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>Report</Text>
        <TouchableOpacity style={styles.topBtn} onPress={handleShare} activeOpacity={0.75}>
          <ShareIcon color={Colors.text} size={20} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}>
        {/* Hero photo */}
        {uniquePhotos.length > 0 ? (
          <View style={styles.photoGallery}>
            <SignedImage path={uniquePhotos[activePhoto] || uniquePhotos[0]} style={styles.heroPhoto} />
            {uniquePhotos.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbRow}
              >
                {uniquePhotos.map((p, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setActivePhoto(i)}
                    activeOpacity={0.85}
                  >
                    <SignedImage
                      path={p}
                      style={[styles.thumb, activePhoto === i && styles.thumbActive]}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={styles.heroFallback}>
            <Icon color={Colors.textTertiary} size={48} />
          </View>
        )}

        {/* Type + severity badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.typeBadge, { backgroundColor: sevStyle.bg }]}>
            <Icon color={sevStyle.color} size={14} />
            <Text style={[styles.typeBadgeText, { color: sevStyle.color }]}>{typeLabel}</Text>
          </View>
          <View style={[styles.sevBadge, { backgroundColor: sevStyle.bg }]}>
            <Text style={[styles.sevBadgeText, { color: sevStyle.color }]}>{sevStyle.label}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {report.pet_name || typeLabel}
        </Text>
        <Text style={styles.subtitle}>
          {report.breed ? `${report.breed} · ` : ''}
          {report.animal_kind || report.pet_type || 'Animal'}
        </Text>

        {/* Time + location */}
        <View style={styles.metaRow}>
          <Clock color={Colors.textTertiary} size={14} />
          <Text style={styles.metaText}>Reported {timeAgo(report.created_at)}</Text>
        </View>
        <View style={styles.metaRow}>
          <MapPin color={Colors.textTertiary} size={14} />
          <Text style={styles.metaText} numberOfLines={2}>{report.location_address}</Text>
        </View>
        {report.last_seen_at && (
          <View style={styles.metaRow}>
            <Clock color={Colors.textTertiary} size={14} />
            <Text style={styles.metaText}>Last seen {formatDateTime(report.last_seen_at)}</Text>
          </View>
        )}

        {/* Navigate button */}
        {report.latitude != null && report.longitude != null && (
          <TouchableOpacity style={styles.navigateBtn} onPress={openMaps} activeOpacity={0.85}>
            <Navigation color={Colors.coral} size={18} />
            <Text style={styles.navigateBtnText}>Open in Maps</Text>
          </TouchableOpacity>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText}>{report.description}</Text>
        </View>

        {/* Physical traits */}
        {physicalFields.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Physical traits</Text>
            <View style={styles.traitsGrid}>
              {physicalFields.map((f, i) => (
                <View key={i} style={styles.traitItem}>
                  <Text style={styles.traitLabel}>{f!.label}</Text>
                  <Text style={styles.traitValue}>{f!.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* AI Analysis */}
        {aiFields.length > 0 && (
          <View style={styles.section}>
            <View style={styles.aiHeader}>
              <Sparkles color={Colors.accent} size={16} />
              <Text style={styles.sectionTitle}>AI Photo Analysis</Text>
            </View>
            {!aiDone && (
              <Text style={styles.aiPending}>Analysis in progress…</Text>
            )}
            <View style={styles.traitsGrid}>
              {aiFields.map((f, i) => (
                <View key={i} style={styles.traitItem}>
                  <Text style={styles.traitLabel}>{f!.label}</Text>
                  <Text style={styles.traitValue}>{f!.value}</Text>
                </View>
              ))}
            </View>
            {report.ai_summary && (
              <Text style={styles.aiSummary}>{report.ai_summary}</Text>
            )}
            {riskTags.length > 0 && (
              <View style={styles.riskTagsRow}>
                {riskTags.map((tag, i) => (
                  <View key={i} style={styles.riskTag}>
                    <Text style={styles.riskTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Contact */}
        {canContact ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.contactName}>Reported by {report.contact_name || 'Anonymous'}</Text>
            <View style={styles.contactButtons}>
              {report.contact_phone && (
                <TouchableOpacity style={styles.contactBtn} onPress={callPhone} activeOpacity={0.85}>
                  <Phone color={Colors.coral} size={18} />
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>
              )}
              {report.contact_email && (
                <TouchableOpacity style={styles.contactBtn} onPress={sendEmail} activeOpacity={0.85}>
                  <Mail color={Colors.coral} size={18} />
                  <Text style={styles.contactBtnText}>Email</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : report.contact_name ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.contactName}>Reported by {report.contact_name}</Text>
            {!report.allow_direct_contact && (
              <Text style={styles.contactNote}>Direct contact is not enabled for this report.</Text>
            )}
          </View>
        ) : null}

        {/* Linked pet */}
        {report.pet_id && (
          <TouchableOpacity
            style={styles.linkedPetCard}
            onPress={() => router.push(`/pet-details?id=${report.pet_id}`)}
            activeOpacity={0.85}
          >
            <PawPrint color={Colors.coral} size={20} />
            <Text style={styles.linkedPetText}>View linked pet profile</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, marginTop: 12, textAlign: 'center' },
  errorBackBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.coral },
  errorBackText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.white },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topTitle: { flex: 1, fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },

  scrollContent: { paddingHorizontal: 20 },

  photoGallery: { marginBottom: 16 },
  heroPhoto: { width: '100%', height: 260, borderRadius: 16, backgroundColor: Colors.surface },
  heroFallback: { width: '100%', height: 200, borderRadius: 16, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  thumbRow: { gap: 8, marginTop: 10 },
  thumb: { width: 56, height: 56, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: Colors.coral },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  typeBadgeText: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  sevBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  sevBadgeText: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 0.5 },

  title: { fontSize: FontSizes['2xl'], fontFamily: Fonts.extrabold, color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: 12 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  metaText: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, flex: 1 },

  navigateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.coralBg, borderWidth: 1.5, borderColor: Colors.coral, marginTop: 8, marginBottom: 20 },
  navigateBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.coral },

  section: { backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  sectionTitle: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 10 },

  descriptionText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textBody, lineHeight: 22 },

  traitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  traitItem: { minWidth: '45%', flexBasis: '45%' },
  traitLabel: { fontSize: FontSizes.xs, fontFamily: Fonts.semibold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  traitValue: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text },

  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  aiPending: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary, fontStyle: 'italic', marginBottom: 10 },
  aiSummary: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textBody, lineHeight: 20, marginTop: 12 },
  riskTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  riskTag: { backgroundColor: Colors.criticalBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  riskTagText: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.critical },

  contactName: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text, marginBottom: 12 },
  contactNote: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 4 },
  contactButtons: { flexDirection: 'row', gap: 10 },
  contactBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.coralBg, borderWidth: 1.5, borderColor: Colors.coral },
  contactBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.coral },

  linkedPetCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  linkedPetText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.coral, flex: 1 },
});
