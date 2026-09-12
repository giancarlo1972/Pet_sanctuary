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
  Modal,
  TextInput,
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
  Pencil,
  CircleCheck,
  Ban,
  Zap,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import SignedImage from '@/components/SignedImage';
import { InlineBanner } from '@/components/InlineBanner';
import { useAuth } from '@/lib/context/AuthContext';
import { DateField } from '@/components/DateField';
import { pickImage } from '@/lib/pick-image';
import { encodeGeohash } from '@/lib/geohash';
import { geocodePlace } from '@/lib/geocode';
import {
  boostAvailableAt,
  ownerActionMessage,
  outcomeLabel,
  reportStatusStyle,
  updateMyReport,
} from '@/lib/my-reports';

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
  user_id: string | null;
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
  pet_id?: string | null;
  moderator_note?: string | null;
  resolution_outcome?: string | null;
  cancel_reason?: string | null;
  last_boosted_at?: string | null;
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
  open: { bg: Colors.coralBg, color: Colors.coral, label: 'Active' },
  pending_moderation: { bg: Colors.standardBg, color: Colors.accentDark, label: 'Pending moderation' },
  pending: { bg: Colors.standardBg, color: Colors.accentDark, label: 'Pending moderation' },
  resolved: { bg: Colors.tealBg, color: Colors.teal, label: 'Resolved' },
  closed: { bg: Colors.surface, color: Colors.textSecondary, label: 'Cancelled' },
  cancelled: { bg: Colors.surface, color: Colors.textSecondary, label: 'Cancelled' },
  rejected: { bg: Colors.criticalBg, color: Colors.critical, label: 'Rejected' },
  dismissed: { bg: Colors.criticalBg, color: Colors.critical, label: 'Rejected' },
};

const DETAIL_SELECT =
  'id, report_type, urgency, incident_category, pet_name, pet_type, breed, description, location_address, latitude, longitude, photo_urls, photo_url, status, severity, created_at, last_seen_at, colors, life_stage, size, gender, animal_kind, approximate_public, allow_direct_contact, user_id, pet_id, ai_summary, ai_species, ai_breed, ai_colors, ai_coat, ai_confidence, ai_priority, ai_risk_tags, ai_age_range, ai_analyzed_at, moderator_note, resolution_outcome, cancel_reason, last_boosted_at';

const DETAIL_SELECT_SAFE =
  'id, report_type, urgency, incident_category, pet_name, pet_type, breed, description, location_address, latitude, longitude, photo_urls, photo_url, status, severity, created_at, user_id, animal_kind';

const DETAIL_SELECT_MIN =
  'id, report_type, urgency, incident_category, pet_name, pet_type, breed, description, location_address, latitude, longitude, photo_urls, status, created_at';

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
  const { user } = useAuth();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [editLoc, setEditLoc] = useState('');
  const [editSeen, setEditSeen] = useState('');
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    loadReport();
  }, [id]);

  const loadReport = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      let data: ReportDetail | null = null;
      const first = await supabase.from('reports').select(DETAIL_SELECT).eq('id', id).maybeSingle();
      if (first.error) {
        console.error('[report-details] query failed:', first.error.message, first.error.details, first.error.hint, first.error.code);
        const retry = await supabase.from('reports').select(DETAIL_SELECT_SAFE).eq('id', id).maybeSingle();
        if (!retry.error) {
          data = retry.data as ReportDetail | null;
        } else {
          console.error('[report-details] retry failed:', retry.error.message, retry.error.details, retry.error.hint, retry.error.code);
          const min = await supabase.from('reports').select(DETAIL_SELECT_MIN).eq('id', id).maybeSingle();
          if (min.error) {
            console.error('[report-details] min failed:', min.error.message, min.error.details, min.error.hint, min.error.code);
            setError(min.error.message || retry.error.message || first.error.message || 'We could not load this report.');
            setLoading(false);
            return;
          }
          data = min.data as ReportDetail | null;
        }
      } else {
        data = first.data as ReportDetail | null;
      }

      if (!data) {
        setError('This report could not be found. It may have been removed.');
      } else {
        setReport(data);
      }
    } catch (err: any) {
      const text = err?.message || String(err);
      console.error('[report-details] load failed:', text);
      setError(text || 'We could not load this report.');
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

  const runAction = async (action: 'edit' | 'resolve' | 'cancel' | 'boost', payload: Record<string, unknown> = {}) => {
    if (!report) return;
    setBusy(true);
    try {
      const rec = await updateMyReport(report.id, action, payload);
      setEditOpen(false);
      setResolveOpen(false);
      setCancelOpen(false);
      setCancelReason('');
      if (action === 'boost') {
        const n = Number(rec.helpers_notified) || 0;
        setBanner({
          kind: 'success',
          message: n > 0
            ? `Boosted. ${n} helper${n === 1 ? '' : 's'} on duty nearby ${n === 1 ? 'was' : 'were'} notified.`
            : 'Boosted. No helpers on duty in this area right now.',
        });
      } else if (action === 'edit') {
        setBanner({ kind: 'success', message: 'Saved. This report is back in moderation.' });
      } else if (action === 'resolve') {
        setBanner({ kind: 'success', message: 'Marked resolved.' });
      } else {
        setBanner({ kind: 'success', message: 'Report cancelled.' });
      }
      await loadReport();
    } catch (e: any) {
      setBanner({ kind: 'error', message: ownerActionMessage(e) });
    }
    setBusy(false);
  };

  const openEdit = () => {
    if (!report) return;
    setEditDesc(report.description || '');
    setEditLoc(report.location_address || '');
    setEditSeen((report.last_seen_at || '').slice(0, 10));
    const photos = [...(report.photo_urls || []), ...(report.photo_url ? [report.photo_url] : [])].filter(Boolean);
    setEditPhotos([...new Set(photos)]);
    setEditOpen(true);
  };

  const addEditPhoto = async () => {
    try {
      const picked = await pickImage();
      if (!picked) return;
      const path = `reports/${Date.now()}.jpg`;
      const up = await supabase.storage.from('report-photos').upload(path, picked.blob, { contentType: 'image/jpeg', upsert: true });
      if (up.error) {
        const fallback = await supabase.storage.from('pet-photos').upload(path, picked.blob, { contentType: 'image/jpeg', upsert: true });
        if (fallback.error) throw fallback.error;
      }
      setEditPhotos((p) => [...p, path]);
    } catch (e: any) {
      setBanner({ kind: 'error', message: e?.message || 'Could not add photo.' });
    }
  };

  const saveEdit = async () => {
    if (!editDesc.trim() || !editLoc.trim()) {
      setBanner({ kind: 'error', message: 'Description and location are required.' });
      return;
    }
    let lat = report?.latitude ?? null;
    let lng = report?.longitude ?? null;
    if (editLoc.trim() !== (report?.location_address || '').trim()) {
      try {
        const hit = await geocodePlace(editLoc.trim());
        if (hit) { lat = hit.lat; lng = hit.lng; }
      } catch { /* keep existing coords */ }
    }
    await runAction('edit', {
      description: editDesc.trim(),
      location_address: editLoc.trim(),
      last_seen_at: editSeen || null,
      photo_urls: editPhotos,
      photo_url: editPhotos[0] || null,
      latitude: lat,
      longitude: lng,
    });
  };

  const boostReport = async () => {
    if (!report) return;
    const next = boostAvailableAt(report.last_boosted_at);
    if (next) {
      setBanner({ kind: 'info', message: `You can boost again after ${formatDateTime(next.toISOString())}.` });
      return;
    }
    let gh = '';
    if (report.latitude != null && report.longitude != null && !(Math.abs(report.latitude) < 0.01 && Math.abs(report.longitude) < 0.01)) {
      gh = encodeGeohash(report.latitude, report.longitude, 5);
    }
    await runAction('boost', { geohash: gh });
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
        <Text style={styles.errorTitle}>
          {error === 'This report could not be found. It may have been removed.'
            ? error
            : 'We could not load this report.'}
        </Text>
        {error && error !== 'This report could not be found. It may have been removed.' ? (
          <Text style={styles.errorHint}>{error}</Text>
        ) : null}
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.errorBackText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sev = report.severity || 'standard';
  const sevStyle = SEVERITY_STYLE[sev] || SEVERITY_STYLE.standard;
  const statusStyle = STATUS_STYLE[report.status] || reportStatusStyle(report.status);
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
  ].filter((f): f is { label: string; value: string } => Boolean(f && typeof f === 'object'));

  const physicalFields = [
    report.animal_kind && { label: 'Animal', value: report.animal_kind },
    report.breed && { label: 'Breed', value: report.breed },
    report.gender && { label: 'Gender', value: report.gender },
    report.life_stage && { label: 'Life stage', value: report.life_stage },
    report.size && { label: 'Size', value: report.size },
    report.colors && report.colors.length > 0 && { label: 'Colors', value: report.colors.join(', ') },
  ].filter((f): f is { label: string; value: string } => Boolean(f && typeof f === 'object'));

  const riskTags = report.ai_risk_tags || [];
  const aiDone = report.ai_analyzed_at != null;
  const mine = !!(user?.id && report.user_id && user.id === report.user_id);
  const pending = report.status === 'pending_moderation' || report.status === 'pending';
  const live = report.status === 'active' || report.status === 'open';
  const closed = report.status === 'cancelled' || report.status === 'closed';
  const resolved = report.status === 'resolved';
  const boostNext = boostAvailableAt(report.last_boosted_at);

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
                      style={activePhoto === i ? [styles.thumb, styles.thumbActive] as any : styles.thumb}
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
          {pending ? (
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>Pending moderation</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
            </View>
          )}
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
        <Text style={styles.reporterLine}>Reported by {mine ? 'You' : 'a community member'}</Text>
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
                  <Text style={styles.traitLabel}>{f.label}</Text>
                  <Text style={styles.traitValue}>{f.value}</Text>
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
                  <Text style={styles.traitLabel}>{f.label}</Text>
                  <Text style={styles.traitValue}>{f.value}</Text>
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

        {/* Reporter — never join profiles; contact_* is not selectable for anon */}
        {mine ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <Text style={styles.contactName}>Reported by You</Text>
            {pending ? (
              <Text style={styles.contactNote}>This report is pending moderation. Nearby responders will see it once it is approved.</Text>
            ) : null}
            {resolved && outcomeLabel(report.resolution_outcome) ? (
              <Text style={styles.contactNote}>Outcome: {outcomeLabel(report.resolution_outcome)}</Text>
            ) : null}
            {(report.status === 'rejected' || report.status === 'dismissed') && report.moderator_note ? (
              <Text style={styles.contactNote}>Moderator: {report.moderator_note}</Text>
            ) : null}
            {(closed && report.cancel_reason) ? (
              <Text style={styles.contactNote}>Cancelled: {report.cancel_reason}</Text>
            ) : null}
          </View>
        ) : null}

        {mine && !closed ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your report</Text>
            <View style={styles.ownerActions}>
              <TouchableOpacity style={styles.ownerBtn} onPress={openEdit} disabled={busy} activeOpacity={0.85}>
                <Pencil color={Colors.navy} size={16} />
                <Text style={styles.ownerBtnTxt}>Edit</Text>
              </TouchableOpacity>
              {!resolved ? (
                <TouchableOpacity style={styles.ownerBtn} onPress={() => setResolveOpen(true)} disabled={busy} activeOpacity={0.85}>
                  <CircleCheck color={Colors.tealDark} size={16} />
                  <Text style={styles.ownerBtnTxt}>Mark resolved</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.ownerBtn} onPress={() => setCancelOpen(true)} disabled={busy} activeOpacity={0.85}>
                <Ban color={Colors.critical} size={16} />
                <Text style={[styles.ownerBtnTxt, { color: Colors.critical }]}>Cancel</Text>
              </TouchableOpacity>
              {live ? (
                <TouchableOpacity style={styles.ownerBtn} onPress={boostReport} disabled={busy || !!boostNext} activeOpacity={0.85}>
                  <Zap color={boostNext ? Colors.textTertiary : Colors.coral} size={16} />
                  <Text style={[styles.ownerBtnTxt, boostNext ? { color: Colors.textTertiary } : { color: Colors.coral }]}>
                    {boostNext ? 'Boosted' : 'Boost'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {boostNext ? (
              <Text style={styles.contactNote}>Boost again after {formatDateTime(boostNext.toISOString())}.</Text>
            ) : live ? (
              <Text style={styles.contactNote}>Boost re-notifies helpers on duty nearby. Once per 24 hours.</Text>
            ) : null}
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

      <Modal visible={editOpen} animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.topBtn} onPress={() => setEditOpen(false)} activeOpacity={0.75}>
              <ChevronLeft color={Colors.text} size={22} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Edit report</Text>
            <View style={styles.topBtn} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={styles.input}
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              placeholder="What happened?"
              placeholderTextColor={Colors.textTertiary}
            />
            <Text style={styles.fieldLabel}>Last-seen location</Text>
            <TextInput
              style={styles.input}
              value={editLoc}
              onChangeText={setEditLoc}
              placeholder="Neighborhood or address"
              placeholderTextColor={Colors.textTertiary}
            />
            <DateField label="Last seen" value={editSeen} onChange={setEditSeen} />
            <Text style={styles.fieldLabel}>Photos</Text>
            <View style={styles.editPhotos}>
              {editPhotos.map((p) => (
                <View key={p} style={styles.editPhotoWrap}>
                  <SignedImage path={p} style={styles.editPhoto} />
                  <TouchableOpacity
                    style={styles.editPhotoX}
                    onPress={() => setEditPhotos((list) => list.filter((x) => x !== p))}
                  >
                    <Text style={styles.editPhotoXTxt}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {editPhotos.length < 5 ? (
                <TouchableOpacity style={styles.addPhoto} onPress={addEditPhoto} activeOpacity={0.85}>
                  <Text style={styles.addPhotoTxt}>+ Photo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.contactNote}>Edits go back to moderation before they are public again.</Text>
            <TouchableOpacity style={styles.saveBtn} onPress={saveEdit} disabled={busy} activeOpacity={0.85}>
              {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnTxt}>Save changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={resolveOpen} transparent animationType="fade" onRequestClose={() => setResolveOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Mark resolved</Text>
            <Text style={styles.contactNote}>How did this end?</Text>
            {([
              ['found', 'Found'],
              ['rescued', 'Rescued'],
              ['no_longer_needed', 'No longer needed'],
            ] as const).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={styles.sheetRow}
                disabled={busy}
                onPress={() => runAction('resolve', { outcome: key })}
                activeOpacity={0.85}
              >
                <Text style={styles.sheetRowTxt}>{label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setResolveOpen(false)}>
              <Text style={styles.sheetCancelTxt}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Cancel report</Text>
            <Text style={styles.contactNote}>This hides it from the live map. Tell us why.</Text>
            <TextInput
              style={styles.input}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Reason"
              placeholderTextColor={Colors.textTertiary}
            />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: Colors.critical }]}
              disabled={busy || !cancelReason.trim()}
              onPress={() => runAction('cancel', { reason: cancelReason.trim() })}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnTxt}>Cancel report</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setCancelOpen(false)}>
              <Text style={styles.sheetCancelTxt}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, marginTop: 12, textAlign: 'center', paddingHorizontal: 24 },
  errorHint: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.critical, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
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
  reporterLine: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.text, marginTop: 8, marginBottom: 4 },

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

  ownerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ownerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  ownerBtnTxt: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy },
  fieldLabel: { fontFamily: Fonts.extrabold, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.4, textTransform: 'uppercase' },
  input: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 44,
    fontFamily: Fonts.regular, fontSize: FontSizes.md, color: Colors.navy,
    backgroundColor: Colors.white, textAlignVertical: 'top',
  },
  editPhotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editPhotoWrap: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden' },
  editPhoto: { width: 72, height: 72 },
  editPhotoX: {
    position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  editPhotoXTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 14, lineHeight: 16 },
  addPhoto: {
    width: 72, height: 72, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed',
    borderColor: Colors.coral, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white,
  },
  addPhotoTxt: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.coral },
  saveBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnTxt: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.white },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, gap: 10 },
  sheetTitle: { fontFamily: Fonts.extrabold, fontSize: FontSizes.lg, color: Colors.navy },
  sheetRow: { paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center' },
  sheetRowTxt: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.navy },
  sheetCancel: { paddingVertical: 10, alignItems: 'center' },
  sheetCancelTxt: { fontFamily: Fonts.semibold, fontSize: FontSizes.sm, color: Colors.textSecondary },
});
