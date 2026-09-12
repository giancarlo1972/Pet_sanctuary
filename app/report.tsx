import React, { createElement, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Switch,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Linking, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Search, PawPrint, Heart, AlertTriangle, Camera, Image as ImageIcon, MapPin, EyeOff, Sparkles, Check } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { InlineBanner } from '@/components/InlineBanner';
import NearbyMap from '@/components/NearbyMap';
import { CONTENT_MAX } from '@/components/Page';
import { pickImage, releasePicked, imageFromFile, PickImageError, type PickedImage } from '@/lib/pick-image';
import { geocodePlace, reverseGeocode } from '@/lib/geocode';
import { encodeGeohash, decodeGeohash, geohashNeighbors, haversineMi } from '@/lib/geohash';

const INTER = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.regular;
const INTERB = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.bold;
const INTEREB = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.extrabold;

type ReportKind = 'road_accident' | 'injured' | 'lost_found' | 'cruelty';

const TYPES: {
  value: ReportKind;
  label: string;
  desc: string;
  priority: 'STANDARD' | 'URGENT' | 'CRITICAL';
  severity: 'standard' | 'urgent' | 'critical';
  tile: string;
  Icon: typeof Search;
}[] = [
  { value: 'road_accident', label: 'Road accident', desc: 'Animal hit or in traffic', priority: 'CRITICAL', severity: 'critical', tile: Colors.critical, Icon: AlertTriangle },
  { value: 'injured', label: 'Injured', desc: 'Visible injury, needs help', priority: 'URGENT', severity: 'urgent', tile: Colors.urgent, Icon: Heart },
  { value: 'lost_found', label: 'Lost or found', desc: 'Missing or stray animal', priority: 'STANDARD', severity: 'standard', tile: Colors.navy, Icon: Search },
  { value: 'cruelty', label: 'Cruelty', desc: 'Abuse or neglect', priority: 'URGENT', severity: 'urgent', tile: '#6B5EA8', Icon: PawPrint },
];

const PRIORITY_COLOR: Record<string, string> = {
  STANDARD: Colors.standard,
  URGENT: Colors.urgent,
  CRITICAL: Colors.critical,
};

const INCIDENT: Record<ReportKind, string> = {
  road_accident: 'traffic_accident',
  injured: 'animal_injury',
  lost_found: 'lost_pet',
  cruelty: 'abuse_neglect',
};

const URGENCY: Record<string, string> = {
  critical: 'emergency',
  urgent: 'high',
  standard: 'medium',
};

type AiDraft = {
  species: string;
  breed_guess: string;
  colors: string[];
  age_guess: string;
  coat: string;
  confidence: number;
  short_description: string;
  analyzed: boolean;
};

function shortNominatim(label?: string | null) {
  if (!label) return '';
  return label.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3).join(', ');
}

function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLng = (bLng - aLng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function supabaseMessage(err: any, fallback = 'Could not submit report.') {
  const parts = [err?.message, err?.details, err?.hint, err?.code].filter((p) => typeof p === 'string' && p.trim());
  const text = parts.join(' — ').trim();
  return text || fallback;
}

function phoneOk(raw: string) {
  return raw.replace(/\D/g, '').length >= 7;
}

function WebFileBtn({
  camera, label, onFile, onError,
}: {
  camera: boolean;
  label: string;
  onFile: (file: File) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const Icon = camera ? Camera : ImageIcon;
  return createElement(
    'label',
    {
      style: {
        flex: 1,
        display: 'flex',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 48,
        padding: '12px 8px',
        background: '#FFFFFF',
        border: '1px solid #E8EAF0',
        borderRadius: 12,
        cursor: 'pointer',
        overflow: 'hidden',
        boxSizing: 'border-box',
      },
    },
    createElement('input', {
      type: 'file',
      accept: 'image/*',
      ...(camera ? { capture: 'environment' } : {}),
      style: {
        position: 'absolute',
        inset: 0,
        opacity: 0.01,
        width: '100%',
        height: '100%',
        cursor: 'pointer',
        fontSize: 16,
        zIndex: 2,
      },
      onChange: async (ev: any) => {
        const file = ev?.target?.files?.[0] as File | undefined;
        if (ev?.target) ev.target.value = '';
        if (!file) return;
        try {
          await onFile(file);
        } catch (e: any) {
          onError(e?.message || 'Could not read that picture.');
        }
      },
    }),
    createElement(Icon as any, { color: '#26265E', size: 16, style: { pointerEvents: 'none' } }),
    createElement('span', {
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 700,
        fontSize: 13,
        color: '#26265E',
        pointerEvents: 'none',
      },
    }, label),
  );
}

export default function NewReportScreen() {
  const { prefillPetId } = useLocalSearchParams<{ prefillPetId?: string }>();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMs, setAnalyzeMs] = useState<number | null>(null);
  const [ai, setAi] = useState<AiDraft | null>(null);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [communityHits, setCommunityHits] = useState<{ id: string; name: string; territory?: string | null; tnr_status?: string | null; species?: string | null }[]>([]);
  const [petName, setPetName] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [approxPublic, setApproxPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [sent, setSent] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('Nearby verified responders and shelters were notified. We’ll update you as they respond.');
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const locatedOnce = useRef(false);

  useEffect(() => () => releasePicked(photoUri), [photoUri]);

  useEffect(() => {
    if (step === 3 && !locatedOnce.current && lat == null) {
      locatedOnce.current = true;
      useMyLocation({ silent: true });
    }
  }, [step]);

  useEffect(() => {
    if (!user) {
      if (!contactName) setContactName('Anonymous');
      return;
    }
    setContactName((n) => n && n !== 'Anonymous' ? n : (user.email?.split('@')[0] || 'Anonymous'));
    Promise.resolve(supabase.from('profiles').select('phone, full_name').eq('id', user.id).maybeSingle())
      .then(({ data }) => {
        if (data?.full_name) setContactName(data.full_name);
        if (data?.phone) setPhone((p) => p || data.phone);
      })
      .catch(() => {});
  }, [user]);

  const selected = TYPES.find((t) => t.value === kind) || null;

  const runAnalyze = async (dataUrl: string) => {
    setAnalyzing(true);
    setMatchCount(null);
    const t0 = Date.now();
    try {
      const resp = await fetch('/api/analyze-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });
      const json = await resp.json();
      const draft: AiDraft = {
        species: json.species || 'Other',
        breed_guess: json.breed_guess || 'Unknown',
        colors: Array.isArray(json.colors) ? json.colors : [],
        age_guess: json.age_guess || 'unknown',
        coat: json.coat || '',
        confidence: Number(json.confidence) || 0,
        short_description: json.short_description || '',
        analyzed: !!json.analyzed,
      };
      setAi(draft);
      setAnalyzeMs(Date.now() - t0);
      if (draft.short_description && !description.trim()) setDescription(draft.short_description);
      if (draft.species && draft.species !== 'Other') {
        const { count } = await supabase
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .in('report_type', ['lost', 'stray', 'lost_found'])
          .eq('ai_species', draft.species)
          .in('status', ['active', 'open', 'pending_moderation']);
        if (typeof count === 'number') setMatchCount(count);
      }
    } catch {
      setAi(null);
      setBanner({ message: 'AI is unavailable. Add a short description yourself.', kind: 'info' });
    }
    setAnalyzing(false);
  };

  const loadCommunityHits = async (la?: number | null, ln?: number | null) => {
    if (kind !== 'lost_found') { setCommunityHits([]); return; }
    const a = la ?? lat;
    const b = ln ?? lng;
    if (a == null || b == null || !user) { setCommunityHits([]); return; }
    try {
      const hashes = geohashNeighbors(encodeGeohash(a, b, 5));
      const { data } = await supabase
        .from('pets')
        .select('id, name, species, territory, geohash, tnr_status')
        .eq('listing_type', 'community')
        .in('geohash', hashes)
        .limit(12);
      const rows = (data || []).filter((p: any) => {
        if (!p.geohash) return false;
        try {
          const c = decodeGeohash(p.geohash);
          return haversineMi({ lat: a, lng: b }, c) <= 10;
        } catch { return false; }
      });
      setCommunityHits(rows);
    } catch {
      setCommunityHits([]);
    }
  };

  const applyPicked = async (picked: PickedImage) => {
    setBanner(null);
    setPhotoError(null);
    setCameraDenied(false);
    releasePicked(photoUri);
    setPhotoUri(picked.uri);
    setPhotoBlob(picked.blob);
    setAi(null);
    setAnalyzeMs(null);
    runAnalyze(picked.dataUrl);
  };

  const onPhotoError = (msg: string, code?: string) => {
    const text = (msg || '').trim() || 'Could not read that picture.';
    if (code === 'camera-denied') {
      setCameraDenied(true);
      setPhotoError(text);
      return;
    }
    setPhotoError(text);
    setBanner({ message: text, kind: 'error' });
  };

  const applyPhoto = async (camera: boolean) => {
    setBanner(null);
    setPhotoError(null);
    try {
      const picked = await pickImage({ camera });
      if (!picked) return;
      await applyPicked(picked);
    } catch (e: any) {
      const msg = e?.message || 'Could not read that picture.';
      onPhotoError(msg, e instanceof PickImageError ? e.code : undefined);
    }
  };

  const applyWebFile = async (file: File) => {
    setBanner(null);
    setPhotoError(null);
    try {
      const picked = await imageFromFile(file);
      await applyPicked(picked);
    } catch (e: any) {
      onPhotoError(e?.message || 'Could not read that picture.');
    }
  };

  const clearPhoto = () => {
    releasePicked(photoUri);
    setPhotoUri(null);
    setPhotoBlob(null);
    setPhotoError(null);
    setAi(null);
    setAnalyzeMs(null);
    setMatchCount(null);
  };

  const useMyLocation = (opts?: { silent?: boolean }) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (!opts?.silent) setBanner({ message: 'Location is not available in this browser.', kind: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        setLat(la);
        setLng(ln);
        void loadCommunityHits(la, ln);
        const rev = await reverseGeocode(la, ln);
        const label = shortNominatim(rev?.label) || [rev?.city, rev?.stateCode || rev?.state].filter(Boolean).join(', ');
        setLocation(label ? `Detected: ${label}` : `Dropped pin (${la.toFixed(4)}, ${ln.toFixed(4)})`);
        setLocating(false);
      },
      () => {
        if (!opts?.silent) setBanner({ message: 'Could not get location. Type an address instead.', kind: 'error' });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  useEffect(() => {
    if (step !== 3) return;
    const raw = location.replace(/^Detected:\s*/i, '').trim();
    if (raw.length < 6 || location.startsWith('Detected:')) return;
    const t = setTimeout(async () => {
      const hit = await geocodePlace(raw);
      if (hit) {
        setLat(hit.lat);
        setLng(hit.lng);
        void loadCommunityHits(hit.lat, hit.lng);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [location, step]);

  const goNext = async () => {
    setBanner(null);
    if (step === 1 && !kind) return;
    if (step === 2) {
      if (!description.trim()) {
        setBanner({ message: 'Please describe the animal and situation.', kind: 'error' });
        return;
      }
      if (!phoneOk(phone)) {
        setBanner({ message: 'Add a phone number for follow-up. It is never public.', kind: 'error' });
        return;
      }
    }
    if (step === 3) {
      if (!location.trim()) {
        setBanner({ message: 'Location is required.', kind: 'error' });
        return;
      }
      if (lat == null || lng == null) {
        const hit = await geocodePlace(location.replace(/^Detected:\s*/i, ''));
        if (hit) {
          setLat(hit.lat);
          setLng(hit.lng);
        }
      }
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const handleSubmit = async () => {
    if (!kind || !description.trim() || !location.trim()) {
      setBanner({ message: 'Type, description, and location are required.', kind: 'error' });
      return;
    }
    if (!phoneOk(phone)) {
      setBanner({ message: 'Add a phone number for follow-up. It is never public.', kind: 'error' });
      setStep(2);
      return;
    }
    setLoading(true);
    setBanner(null);
    let lastPayload: { status?: string; severity?: string; user_id?: string | null } = {};
    try {
      let photoUrl: string | null = null;
      if (photoBlob) {
        const path = `reports/${Date.now()}.jpg`;
        const up = await supabase.storage.from('report-photos').upload(path, photoBlob, { contentType: 'image/jpeg', upsert: true });
        if (up.error) {
          const fallback = await supabase.storage.from('pet-photos').upload(path, photoBlob, { contentType: 'image/jpeg', upsert: true });
          if (fallback.error) throw fallback.error;
        }
        photoUrl = path;
      }
      const address = location.replace(/^Detected:\s*/i, '').trim();
      const { data: sess } = await supabase.auth.getSession();
      const authUid = sess?.session?.user?.id ?? user?.id ?? null;
      const payload = {
        report_type: kind,
        severity: String(selected?.severity || 'standard').toLowerCase(),
        urgency: URGENCY[selected?.severity || 'standard'],
        incident_category: INCIDENT[kind],
        pet_name: petName.trim() || null,
        animal_kind: ai?.species || null,
        breed: ai?.breed_guess && ai.breed_guess !== 'Unknown' ? ai.breed_guess : null,
        description: description.trim(),
        location_address: address,
        latitude: lat ?? 0,
        longitude: lng ?? 0,
        contact_name: contactName.trim() || user?.email?.split('@')[0] || 'Anonymous',
        contact_phone: phone.trim(),
        contact_email: user?.email || null,
        pet_id: prefillPetId || null,
        photo_url: photoUrl,
        photo_urls: photoUrl ? [photoUrl] : [],
        status: 'pending_moderation',
        approximate_public: approxPublic,
        allow_direct_contact: false,
        user_id: authUid,
        ai_species: ai?.species || null,
        ai_breed: ai?.breed_guess || null,
        ai_colors: ai?.colors?.length ? ai.colors : null,
        ai_age_range: ai?.age_guess || null,
        ai_coat: ai?.coat || null,
        ai_confidence: ai?.confidence || null,
        ai_summary: ai?.short_description || null,
        ai_analyzed_at: ai?.analyzed ? new Date().toISOString() : null,
      };
      console.log('[reports.insert] anon fields', {
        status: payload.status,
        severity: payload.severity,
        user_id: payload.user_id,
        authUid,
        session: Boolean(sess?.session),
        contextUser: user?.id ?? null,
      });
      console.log('[reports.insert] payload', JSON.stringify(payload));
      lastPayload = { status: payload.status, severity: payload.severity, user_id: payload.user_id };
      const { data, error } = await supabase.rpc('insert_report', { p: payload });
      if (error) {
        console.log('[reports.insert] error', error.message, error.code, error.details, {
          status: payload.status,
          severity: payload.severity,
          user_id: payload.user_id,
        });
        throw error;
      }
      const newId = typeof data === 'string' ? data : (data as { id?: string } | null)?.id;
      if (!newId) throw new Error('insert_report returned no id');
      setSubmittedId(newId);
      if (lat != null && lng != null) {
        try {
          const { data: orgs } = await supabase
            .from('organizations')
            .select('id, latitude, longitude')
            .eq('status', 'approved')
            .not('latitude', 'is', null)
            .limit(200);
          const n = (orgs || []).filter((o: any) => {
            const ola = Number(o.latitude);
            const oln = Number(o.longitude);
            return Number.isFinite(ola) && Number.isFinite(oln) && kmBetween(lat, lng, ola, oln) <= 1.61;
          }).length;
          if (n > 0) {
            setSuccessMsg(`${n} shelter${n === 1 ? '' : 's'} within 1 mile ${n === 1 ? 'was' : 'were'} notified. We’ll update you as they respond.`);
          }
        } catch { /* keep default copy */ }
      }
      setSent(true);
    } catch (err: any) {
      const extra = `status=${lastPayload.status ?? 'unset'} severity=${lastPayload.severity ?? 'unset'} user_id=${lastPayload.user_id ?? 'null'}`;
      setBanner({ message: `${supabaseMessage(err)} · ${extra}`, kind: 'error' });
    }
    setLoading(false);
  };

  const continueDisabled =
    (step === 1 && !kind) ||
    (step === 2 && (!description.trim() || !phoneOk(phone))) ||
    (step === 3 && !location.trim()) ||
    loading;

  const onCancel = () => router.back();

  const photoButtons = Platform.OS === 'web' ? (
    <View style={styles.photoActions}>
      <WebFileBtn camera label="Take photo" onFile={applyWebFile} onError={(m) => onPhotoError(m)} />
      <WebFileBtn camera={false} label="Choose from library" onFile={applyWebFile} onError={(m) => onPhotoError(m)} />
    </View>
  ) : (
    <View style={styles.photoActions}>
      <TouchableOpacity style={styles.photoBtn} onPress={() => applyPhoto(true)} activeOpacity={0.85}>
        <Camera color={Colors.navy} size={16} />
        <Text style={styles.photoBtnText}>Take photo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.photoBtn} onPress={() => applyPhoto(false)} activeOpacity={0.85}>
        <ImageIcon color={Colors.navy} size={16} />
        <Text style={styles.photoBtnText}>Choose from library</Text>
      </TouchableOpacity>
    </View>
  );

  if (sent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successWrap}>
          <View style={styles.successCircle}>
            <Check color={Colors.white} size={36} strokeWidth={3} />
          </View>
          <Text style={styles.successTitle}>Alert sent</Text>
          <Text style={styles.successBody}>{successMsg}</Text>
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => router.replace(`/report-details?id=${submittedId}`)}
            activeOpacity={0.85}
          >
            <Text style={styles.trackText}>Track my report</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.chrome}>
        <View style={styles.chromeInner}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.topBtn}
              onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
              activeOpacity={0.75}
            >
              <ChevronLeft color={Colors.text} size={22} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Report an animal</Text>
            <Text style={styles.stepHint}>{step} of 4</Text>
          </View>
          <View style={styles.progressRow}>
            {[1, 2, 3, 4].map((n) => (
              <View key={n} style={[
                styles.progressBar,
                n < step && styles.progressBarDone,
                n === step && styles.progressBarCurrent,
                n > step && styles.progressBarTodo,
              ]} />
            ))}
          </View>
        </View>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.col}>
            {banner ? (
              <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />
            ) : null}
            {step === 1 && (
              <>
                <Text style={styles.heroTitle}>What happened?</Text>
                <View style={styles.typeGrid}>
                  {[TYPES.slice(0, 2), TYPES.slice(2)].map((row, ri) => (
                    <View key={ri} style={styles.typeRow}>
                      {row.map((t) => {
                        const on = kind === t.value;
                        const Icon = t.Icon;
                        return (
                          <TouchableOpacity
                            key={t.value}
                            style={[styles.typeCard, on && styles.typeCardOn]}
                            onPress={() => setKind(t.value)}
                            activeOpacity={0.85}
                          >
                            <View style={[styles.typeTile, { backgroundColor: t.tile }]}>
                              <Icon color={Colors.white} size={18} />
                            </View>
                            <Text style={styles.typeLabel}>{t.label}</Text>
                            <Text style={styles.typeDesc}>{t.desc}</Text>
                            <Text style={[styles.typePri, { color: PRIORITY_COLOR[t.priority] }]}>{t.priority} PRIORITY</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.heroTitle}>Details</Text>
                {photoUri ? (
                  <View style={styles.photoRow}>
                    <Image source={{ uri: photoUri }} style={styles.thumb} resizeMode="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.photoAdded}>
                        {analyzing
                          ? 'Analyzing…'
                          : analyzeMs != null
                            ? `Analyzed in ${(analyzeMs / 1000).toFixed(1)} s`
                            : 'Photo added'}
                      </Text>
                      <TouchableOpacity onPress={clearPhoto} activeOpacity={0.8}>
                        <Text style={styles.removeLink}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.dashBox}>
                    <Camera color={Colors.textTertiary} size={26} />
                    <Text style={styles.dashTitle}>Add photo</Text>
                    <Text style={styles.dashSub}>AI identifies the animal automatically</Text>
                    {photoButtons}
                  </View>
                )}
                {photoUri ? photoButtons : null}
                {photoError ? (
                  <View style={styles.photoErr}>
                    <Text style={styles.photoErrText}>{photoError}</Text>
                  </View>
                ) : null}
                {cameraDenied ? (
                  <View style={styles.permNote}>
                    <Text style={styles.permText}>Camera access is off. You can still choose a photo from your library.</Text>
                    <View style={styles.permActions}>
                      <TouchableOpacity onPress={() => applyPhoto(false)} activeOpacity={0.85}>
                        <Text style={styles.permLink}>Choose from library</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => Linking.openSettings()} activeOpacity={0.85}>
                        <Text style={styles.permLink}>Open settings</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
                {(analyzing || ai) && (
                  <View style={styles.aiCard}>
                    <View style={styles.aiHead}>
                      <Sparkles color={Colors.teal} size={16} />
                      <Text style={styles.aiTitle}>AI photo analysis</Text>
                    </View>
                    {analyzing ? (
                      <Text style={styles.heroSub}>Looking at the photo…</Text>
                    ) : ai ? (
                      <>
                        <View style={styles.chipRow}>
                          {ai.species ? <View style={styles.chip}><Text style={styles.chipText}>{ai.species}</Text></View> : null}
                          {ai.breed_guess && ai.breed_guess !== 'Unknown' ? (
                            <View style={[styles.chip, styles.chipTeal]}>
                              <Text style={styles.chipTealText}>AI Guess: {ai.breed_guess}</Text>
                            </View>
                          ) : null}
                          {ai.age_guess && ai.age_guess !== 'unknown' ? <View style={styles.chip}><Text style={styles.chipText}>{ai.age_guess}</Text></View> : null}
                          {ai.colors.map((c) => <View key={c} style={styles.chip}><Text style={styles.chipText}>{c}</Text></View>)}
                          {ai.coat ? <View style={styles.chip}><Text style={styles.chipText}>{ai.coat}</Text></View> : null}
                        </View>
                        <Text style={styles.aiDisc}>AI estimate — may be inaccurate. You can edit any trait.</Text>
                      </>
                    ) : null}
                  </View>
                )}
                {kind === 'lost_found' && matchCount != null && matchCount > 0 ? (
                  <View style={styles.matchNote}>
                    <Text style={styles.matchText}>
                      These traits are compared against lost & found reports nearby —{' '}
                      <Text style={styles.matchEm}>{matchCount} possible match{matchCount === 1 ? '' : 'es'}</Text>
                      {' '}found already.
                    </Text>
                  </View>
                ) : null}
                {kind === 'lost_found' && communityHits.length ? (
                  <View style={styles.matchNote}>
                    <Text style={styles.matchText}>
                      <Text style={styles.matchEm}>Is this a known community pet nearby?</Text>
                    </Text>
                    {communityHits.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => router.push(`/pet-details?id=${p.id}`)}
                        style={{ paddingVertical: 8 }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.matchEm}>{p.name}</Text>
                        <Text style={styles.matchText}>
                          {[p.species, p.territory, p.tnr_status === 'done' ? 'TNR' : null].filter(Boolean).join(' · ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.fieldLabel}>Your phone (for follow-up, never public)</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={Colors.textTertiary}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Describe the animal and situation…"
                  placeholderTextColor={Colors.textTertiary}
                  multiline
                />
                <TextInput
                  style={styles.input}
                  value={petName}
                  onChangeText={setPetName}
                  placeholder="Name (optional)"
                  placeholderTextColor={Colors.textTertiary}
                />
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.heroTitle}>Location & privacy</Text>
                {kind === 'lost_found' && communityHits.length ? (
                  <View style={styles.matchNote}>
                    <Text style={styles.matchText}>
                      <Text style={styles.matchEm}>Is this a known community pet nearby?</Text>
                    </Text>
                    {communityHits.map((p) => (
                      <TouchableOpacity key={p.id} onPress={() => router.push(`/pet-details?id=${p.id}`)} style={{ paddingVertical: 8 }} activeOpacity={0.85}>
                        <Text style={styles.matchEm}>{p.name}</Text>
                        <Text style={styles.matchText}>{[p.species, p.territory, p.tnr_status === 'done' ? 'TNR' : null].filter(Boolean).join(' · ')}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                {lat != null && lng != null ? (
                  <LocationPreview lat={lat} lng={lng} />
                ) : (
                  <TouchableOpacity style={styles.mapPlaceholder} onPress={() => useMyLocation()} disabled={locating} activeOpacity={0.85}>
                    <MapPin color={Colors.coral} size={28} />
                    <Text style={styles.mapPhText}>{locating ? 'Detecting location…' : 'Tap to use my location'}</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.detectedRow}>
                  <MapPin color={Colors.coral} size={16} />
                  <TextInput
                    style={styles.detectedInput}
                    value={location}
                    onChangeText={setLocation}
                    placeholder="Address or area"
                    placeholderTextColor={Colors.textTertiary}
                  />
                </View>
                <View style={styles.privacyCard}>
                  <View style={styles.privacyIcon}>
                    <EyeOff color={Colors.navy} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.privacyTitle}>Show approximate location publicly</Text>
                    <Text style={styles.privacySub}>Public map shows a ~300 m area. Exact pin is shared only with verified responders.</Text>
                  </View>
                  <Switch
                    value={approxPublic}
                    onValueChange={setApproxPublic}
                    trackColor={{ false: '#E8EAF0', true: Colors.teal }}
                    thumbColor={Colors.white}
                  />
                </View>
              </>
            )}

            {step === 4 && (
              <>
                <Text style={styles.heroTitle}>Review & send</Text>
                <View style={styles.reviewCard}>
                  <ReviewRow label="Type" value={selected?.label || ''} />
                  <ReviewRow label="Priority" value={selected ? selected.priority : ''} color={selected ? PRIORITY_COLOR[selected.priority] : undefined} />
                  <ReviewRow label="Location" value={location.replace(/^Detected:\s*/i, '')} />
                  <ReviewRow label="Privacy" value={approxPublic ? 'Approximate on public map' : 'Exact location hidden from public'} color={Colors.teal} />
                </View>
                <View style={styles.warnCard}>
                  <Text style={styles.warnText}>Reports are moderated in minutes. Deliberate false reports lead to account suspension.</Text>
                </View>
              </>
            )}
          </View>
        </ScrollView>
        <View style={styles.footerBar}>
          <View style={styles.footerInner}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.footerCta, continueDisabled && styles.footerCtaOff, step === 4 && styles.footerCtaSend]}
              onPress={step === 4 ? handleSubmit : goNext}
              disabled={continueDisabled}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.footerCtaText}>{step === 4 ? 'Send alert' : 'Continue'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LocationPreview({ lat, lng }: { lat: number; lng: number }) {
  return (
    <View style={styles.mapWrap}>
      <NearbyMap
        center={{ lat, lng }}
        zoom={16}
        radiusKm={0.3}
        pins={[]}
        onSelect={() => {}}
        mode="pin"
      />
    </View>
  );
}

function ReviewRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewKey}>{label}</Text>
      <Text style={[styles.reviewVal, color ? { color, fontFamily: INTERB, fontWeight: '700' } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  chrome: { backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center' },
  chromeInner: { width: '100%', maxWidth: CONTENT_MAX },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topTitle: { flex: 1, fontSize: FontSizes.xl, fontFamily: INTEREB, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  stepHint: { width: 56, textAlign: 'right', fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '600', color: Colors.textSecondary },
  progressRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  progressBar: { flex: 1, height: 4, borderRadius: 999 },
  progressBarDone: { backgroundColor: Colors.teal },
  progressBarCurrent: { backgroundColor: Colors.coral },
  progressBarTodo: { backgroundColor: '#E8EAF0' },
  scroll: { flexGrow: 1, alignItems: 'center', paddingBottom: 24 },
  col: { width: '100%', maxWidth: CONTENT_MAX, paddingHorizontal: 16, gap: 14, paddingTop: 8 },
  heroTitle: { fontSize: 22, fontFamily: INTEREB, fontWeight: '800', color: Colors.text, marginTop: 4, marginBottom: 2 },
  heroSub: { fontSize: FontSizes.md, fontFamily: INTER, color: Colors.textSecondary, marginBottom: 4, lineHeight: 20 },
  typeGrid: { gap: 10, marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    minHeight: 148,
  },
  typeCardOn: { borderColor: Colors.coral },
  typeTile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  typeLabel: { fontSize: FontSizes.md, fontFamily: INTERB, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  typeDesc: { fontSize: 12.5, fontFamily: INTER, color: Colors.textSecondary, lineHeight: 17, flex: 1 },
  typePri: { fontSize: 10, fontFamily: INTERB, fontWeight: '700', letterSpacing: 0.6, marginTop: 10 },
  dashBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.borderInput,
    borderRadius: 16,
    backgroundColor: Colors.white,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  dashTitle: { fontSize: FontSizes.md, fontFamily: INTERB, fontWeight: '700', color: Colors.text, marginTop: 4 },
  dashSub: { fontSize: FontSizes.sm, fontFamily: INTER, color: Colors.textTertiary, marginBottom: 4 },
  photoActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  photoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    position: 'relative',
    minHeight: 48,
  },
  photoBtnText: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '700', color: Colors.navy },
  photoErr: { backgroundColor: Colors.criticalBg, borderRadius: 12, padding: 12 },
  photoErrText: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '600', color: Colors.critical, lineHeight: 18 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: Colors.border },
  thumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: Colors.surface },
  photoAdded: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  removeLink: { color: Colors.coral, fontFamily: INTERB, fontWeight: '700', fontSize: FontSizes.sm },
  permNote: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12, gap: 6 },
  permText: { fontSize: FontSizes.sm, fontFamily: INTER, color: Colors.textSecondary, lineHeight: 18 },
  permActions: { flexDirection: 'row', gap: 16 },
  permLink: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '700', color: Colors.coral },
  aiCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiTitle: { fontSize: 14, fontFamily: INTEREB, fontWeight: '800', color: Colors.text },
  aiDisc: { fontSize: 11, fontFamily: INTER, fontStyle: 'italic', color: Colors.textTertiary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surface },
  chipText: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '600', color: Colors.navy },
  chipTeal: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.teal },
  chipTealText: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '600', color: Colors.teal },
  matchNote: { backgroundColor: Colors.tealBg, borderRadius: 12, padding: 12 },
  matchText: { fontSize: FontSizes.sm, fontFamily: INTER, color: Colors.tealDark, lineHeight: 18 },
  matchEm: { fontFamily: INTERB, fontWeight: '700' },
  fieldLabel: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '700', color: Colors.text, marginTop: 2 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: FontSizes.md, fontFamily: INTER, color: Colors.text, backgroundColor: Colors.white },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  mapWrap: { height: 200, borderRadius: 16, overflow: 'hidden', backgroundColor: '#e6e9ee' },
  mapPlaceholder: {
    height: 180,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapPhText: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '700', color: Colors.textSecondary },
  detectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  detectedInput: { flex: 1, fontSize: FontSizes.md, fontFamily: INTER, color: Colors.text, paddingVertical: 12 },
  privacyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  privacyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  privacyTitle: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  privacySub: { fontSize: 12, fontFamily: INTER, color: Colors.textSecondary, lineHeight: 16 },
  reviewCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  reviewKey: { fontSize: 13, fontFamily: INTER, color: Colors.textSecondary, width: 88 },
  reviewVal: { flex: 1, textAlign: 'right', fontSize: FontSizes.md, fontFamily: INTERB, fontWeight: '700', color: Colors.text, lineHeight: 20 },
  warnCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14 },
  warnText: { fontSize: FontSizes.sm, fontFamily: INTER, color: Colors.textSecondary, lineHeight: 18 },
  footerBar: { backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border, alignItems: 'center' },
  footerInner: { width: '100%', maxWidth: CONTENT_MAX, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 8 },
  cancelText: { fontSize: FontSizes.md, fontFamily: INTERB, fontWeight: '700', color: Colors.textSecondary },
  footerCta: { flex: 1, backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  footerCtaOff: { backgroundColor: '#C7CBD6' },
  footerCtaSend: { backgroundColor: Colors.coralDark },
  footerCtaText: { fontSize: FontSizes.md, fontFamily: INTERB, fontWeight: '700', color: Colors.white },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, maxWidth: CONTENT_MAX, width: '100%', alignSelf: 'center' },
  successCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.teal, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 26, fontFamily: INTEREB, fontWeight: '800', color: Colors.text, marginBottom: 10 },
  successBody: { fontSize: FontSizes.md, fontFamily: INTER, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  trackBtn: { backgroundColor: Colors.navy, borderRadius: 14, paddingVertical: 16, alignItems: 'center', alignSelf: 'stretch' },
  trackText: { color: Colors.white, fontFamily: INTERB, fontWeight: '700', fontSize: FontSizes.md },
});
