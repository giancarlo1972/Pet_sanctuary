import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Switch,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Search, PawPrint, Heart, AlertTriangle, Camera, Image as ImageIcon, MapPin, EyeOff, Sparkles } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { InlineBanner } from '@/components/InlineBanner';
import { Page, CONTENT_MAX } from '@/components/Page';
import { pickImage, releasePicked } from '@/lib/pick-image';
import { reverseGeocode } from '@/lib/geocode';

const INTER = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.regular;
const INTERB = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.bold;
const INTEREB = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.extrabold;

type ReportKind = 'lost' | 'stray' | 'injured' | 'emergency';

const TYPES: {
  value: ReportKind;
  label: string;
  desc: string;
  priority: 'STANDARD' | 'URGENT' | 'CRITICAL';
  severity: 'standard' | 'urgent' | 'critical';
  tile: string;
  Icon: typeof Search;
}[] = [
  { value: 'lost', label: 'Lost pet', desc: 'Your pet is missing', priority: 'STANDARD', severity: 'standard', tile: Colors.navy, Icon: Search },
  { value: 'stray', label: 'Found / stray', desc: 'You found a stray or unowned animal', priority: 'STANDARD', severity: 'standard', tile: Colors.teal, Icon: PawPrint },
  { value: 'injured', label: 'Injured', desc: 'Animal needs medical help', priority: 'URGENT', severity: 'urgent', tile: Colors.urgent, Icon: Heart },
  { value: 'emergency', label: 'Emergency', desc: 'Immediate danger — act now', priority: 'CRITICAL', severity: 'critical', tile: Colors.critical, Icon: AlertTriangle },
];

const STEPS = [
  { n: 1, label: 'Type' },
  { n: 2, label: 'Details' },
  { n: 3, label: 'Place' },
  { n: 4, label: 'Review' },
];

const PRIORITY_COLOR: Record<string, string> = {
  STANDARD: Colors.accentDark,
  URGENT: Colors.urgent,
  CRITICAL: Colors.critical,
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

export default function NewReportScreen() {
  const { prefillPetId } = useLocalSearchParams<{ prefillPetId?: string }>();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<ReportKind | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [ai, setAi] = useState<AiDraft | null>(null);
  const [petName, setPetName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [approxPublic, setApproxPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cameraDenied, setCameraDenied] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  useEffect(() => () => releasePicked(photoUri), [photoUri]);

  const selected = TYPES.find((t) => t.value === kind) || null;

  const runAnalyze = async (dataUrl: string) => {
    setAnalyzing(true);
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
      if (draft.short_description && !description.trim()) setDescription(draft.short_description);
    } catch {
      setAi(null);
      setBanner({ message: 'AI is unavailable. Add a short description yourself.', kind: 'info' });
    }
    setAnalyzing(false);
  };

  const applyPhoto = async (camera: boolean) => {
    setBanner(null);
    try {
      const picked = await pickImage({ camera });
      if (!picked) return;
      setCameraDenied(false);
      releasePicked(photoUri);
      setPhotoUri(picked.uri);
      setPhotoBlob(picked.blob);
      setPhotoDataUrl(picked.dataUrl);
      setAi(null);
      runAnalyze(picked.dataUrl);
    } catch (e: any) {
      if (e?.code === 'camera-denied') {
        setCameraDenied(true);
        return;
      }
      setBanner({ message: e?.message || 'Could not read that photo.', kind: 'error' });
    }
  };

  const clearPhoto = () => {
    releasePicked(photoUri);
    setPhotoUri(null);
    setPhotoBlob(null);
    setPhotoDataUrl(null);
    setAi(null);
  };

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setBanner({ message: 'Location is not available in this browser.', kind: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        setLat(la);
        setLng(ln);
        const rev = await reverseGeocode(la, ln);
        const label = [rev?.city, rev?.stateCode || rev?.state].filter(Boolean).join(', ');
        setLocation(label || `Current location (${la.toFixed(5)}, ${ln.toFixed(5)})`);
        setLocating(false);
      },
      () => {
        setBanner({ message: 'Could not get location. Type an address instead.', kind: 'error' });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const goNext = () => {
    setBanner(null);
    if (step === 1 && !kind) return;
    if (step === 2 && !description.trim()) {
      setBanner({ message: 'Please describe the animal and situation.', kind: 'error' });
      return;
    }
    if (step === 3 && !location.trim()) {
      setBanner({ message: 'Location is required.', kind: 'error' });
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const handleSubmit = async () => {
    if (!kind || !description.trim() || !location.trim()) {
      setBanner({ message: 'Type, description, and location are required.', kind: 'error' });
      return;
    }
    setLoading(true);
    setBanner(null);
    try {
      let photoUrl: string | null = null;
      if (photoBlob) {
        const path = `reports/${Date.now()}.jpg`;
        const up = await supabase.storage.from('pet-photos').upload(path, photoBlob, { contentType: 'image/jpeg', upsert: true });
        if (!up.error) photoUrl = supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl;
      }
      const { data, error } = await supabase.from('reports').insert({
        report_type: kind,
        severity: selected?.severity || 'standard',
        pet_name: petName.trim() || null,
        animal_kind: ai?.species || null,
        breed: ai?.breed_guess && ai.breed_guess !== 'Unknown' ? ai.breed_guess : null,
        description: description.trim(),
        location_address: location.trim(),
        latitude: lat ?? 0,
        longitude: lng ?? 0,
        contact_name: user?.email?.split('@')[0] || 'Anonymous',
        contact_email: user?.email || null,
        pet_id: prefillPetId || null,
        photo_url: photoUrl,
        status: 'pending_moderation',
        approximate_public: approxPublic,
        allow_direct_contact: false,
        ai_species: ai?.species || null,
        ai_breed: ai?.breed_guess || null,
        ai_colors: ai?.colors?.length ? ai.colors : null,
        ai_age_range: ai?.age_guess || null,
        ai_coat: ai?.coat || null,
        ai_confidence: ai?.confidence || null,
        ai_summary: ai?.short_description || null,
        ai_analyzed_at: ai?.analyzed ? new Date().toISOString() : null,
      }).select('id').single();
      if (error) throw error;
      router.replace(`/report-details?id=${data.id}`);
    } catch (err: any) {
      setBanner({ message: err.message || 'Could not submit report.', kind: 'error' });
    }
    setLoading(false);
  };

  const continueDisabled =
    (step === 1 && !kind) ||
    (step === 2 && !description.trim()) ||
    (step === 3 && !location.trim()) ||
    loading;

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
            <Text style={styles.topTitle}>New report</Text>
            <Text style={styles.stepHint}>{step} of 4</Text>
          </View>
          <View style={styles.progressRow}>
            {STEPS.map((s) => (
              <View key={s.n} style={[
                styles.progressBar,
                s.n < step && styles.progressBarDone,
                s.n === step && styles.progressBarCurrent,
                s.n > step && styles.progressBarTodo,
              ]} />
            ))}
          </View>
        </View>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Page>
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
              <Text style={styles.heroSub}>A photo helps nearby responders and lost/found matching.</Text>
              {photoUri ? (
                <View style={styles.photoWrap}>
                  <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
                  <TouchableOpacity onPress={clearPhoto} activeOpacity={0.8}>
                    <Text style={styles.removeLink}>Remove photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.dashBox}>
                  <Camera color={Colors.textTertiary} size={22} />
                  <Text style={styles.dashTitle}>Add a photo</Text>
                  <Text style={styles.dashSub}>AI identifies the animal automatically</Text>
                  <View style={styles.photoActions}>
                    <TouchableOpacity style={styles.photoBtn} onPress={() => applyPhoto(true)} activeOpacity={0.85}>
                      <Camera color={Colors.white} size={16} />
                      <Text style={styles.photoBtnText}>Take photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoBtnGhost} onPress={() => applyPhoto(false)} activeOpacity={0.85}>
                      <ImageIcon color={Colors.navy} size={16} />
                      <Text style={styles.photoBtnGhostText}>Library</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {cameraDenied ? (
                <View style={styles.permNote}>
                  <Text style={styles.permText}>Camera access is off. You can still choose a photo from your library.</Text>
                  <TouchableOpacity onPress={() => Linking.openSettings()} activeOpacity={0.85}>
                    <Text style={styles.permLink}>Open settings</Text>
                  </TouchableOpacity>
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
                      <Text style={styles.aiDisc}>AI estimate — may be inaccurate. You can edit the description.</Text>
                    </>
                  ) : null}
                </View>
              )}
              <Text style={styles.sectionLabel}>Describe the animal and situation</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Color, size, injuries, what you saw…"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
              <Text style={styles.sectionLabel}>Name (optional)</Text>
              <TextInput
                style={styles.input}
                value={petName}
                onChangeText={setPetName}
                placeholder="If you know the pet’s name"
                placeholderTextColor={Colors.textTertiary}
              />
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.heroTitle}>Location & privacy</Text>
              <TouchableOpacity style={styles.gpsBtn} onPress={useMyLocation} disabled={locating} activeOpacity={0.85}>
                <MapPin color={Colors.white} size={16} />
                <Text style={styles.gpsText}>{locating ? 'Getting location…' : 'Use my location'}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Address or area"
                placeholderTextColor={Colors.textTertiary}
              />
              {lat != null && lng != null && Platform.OS === 'web' ? (
                // @ts-ignore web-only map preview
                <iframe
                  title="map"
                  width="100%"
                  height="180"
                  style={{ border: 0, borderRadius: 12, marginBottom: 10 }}
                  src={`https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
                />
              ) : null}
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
                <ReviewRow label="Priority" value={selected ? `${selected.priority}` : ''} color={selected ? PRIORITY_COLOR[selected.priority] : undefined} />
                <ReviewRow label="Location" value={location} />
                <ReviewRow label="Privacy" value={approxPublic ? 'Approximate on public map' : 'Exact location hidden from public'} color={Colors.tealDark} />
                {petName ? <ReviewRow label="Name" value={petName} /> : null}
                <ReviewRow label="Details" value={description} />
              </View>
              {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" /> : null}
              <View style={styles.warnCard}>
                <Text style={styles.warnText}>Reports are moderated in minutes. Deliberate false reports lead to account suspension.</Text>
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.continueBtn, continueDisabled && styles.continueOff, step === 4 && styles.sendBtn]}
            onPress={step === 4 ? handleSubmit : goNext}
            disabled={continueDisabled}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.continueText}>{step === 4 ? 'Send alert' : 'Continue'}</Text>
            )}
          </TouchableOpacity>
        </Page>
      </KeyboardAvoidingView>
      {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
    </SafeAreaView>
  );
}

function ReviewRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewKey}>{label}</Text>
      <Text style={[styles.reviewVal, color ? { color } : null]}>{value}</Text>
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
  heroTitle: { fontSize: 22, fontFamily: INTEREB, fontWeight: '800', color: Colors.text, marginTop: 8, marginBottom: 4 },
  heroSub: { fontSize: FontSizes.md, fontFamily: INTER, color: Colors.textSecondary, marginBottom: 8, lineHeight: 20 },
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
    padding: 18,
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dashTitle: { fontSize: FontSizes.md, fontFamily: INTERB, fontWeight: '700', color: Colors.text },
  dashSub: { fontSize: FontSizes.sm, fontFamily: INTER, color: Colors.textTertiary, marginBottom: 6 },
  photoActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  photoBtn: { flexDirection: 'row', gap: 6, backgroundColor: Colors.coral, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  photoBtnText: { color: Colors.white, fontFamily: INTERB, fontWeight: '700', fontSize: FontSizes.sm },
  photoBtnGhost: { flexDirection: 'row', gap: 6, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.navy, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  photoBtnGhostText: { color: Colors.navy, fontFamily: INTERB, fontWeight: '700', fontSize: FontSizes.sm },
  photoWrap: { marginTop: 8 },
  preview: { width: '100%', height: 200, borderRadius: 12, backgroundColor: Colors.surface, marginBottom: 8 },
  removeLink: { color: Colors.coral, fontFamily: INTERB, fontWeight: '700', fontSize: FontSizes.sm, marginBottom: 8 },
  permNote: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12, gap: 6 },
  permText: { fontSize: FontSizes.sm, fontFamily: INTER, color: Colors.textSecondary, lineHeight: 18 },
  permLink: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '700', color: Colors.coral },
  aiCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiTitle: { fontSize: FontSizes.md, fontFamily: INTEREB, fontWeight: '800', color: Colors.text },
  aiDisc: { fontSize: 11, fontFamily: INTER, fontStyle: 'italic', color: Colors.textTertiary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surface },
  chipText: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '600', color: Colors.navy },
  chipTeal: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.teal },
  chipTealText: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '600', color: Colors.teal },
  sectionLabel: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: FontSizes.md, fontFamily: INTER, color: Colors.text, backgroundColor: Colors.white },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.navy, borderRadius: 12, paddingVertical: 12 },
  gpsText: { color: Colors.white, fontFamily: INTERB, fontWeight: '700', fontSize: FontSizes.sm },
  privacyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  privacyIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  privacyTitle: { fontSize: FontSizes.sm, fontFamily: INTERB, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  privacySub: { fontSize: 12, fontFamily: INTER, color: Colors.textSecondary, lineHeight: 16 },
  reviewCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 10 },
  reviewRow: { gap: 2 },
  reviewKey: { fontSize: 11, fontFamily: INTERB, fontWeight: '700', color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.4 },
  reviewVal: { fontSize: FontSizes.md, fontFamily: INTER, color: Colors.text, lineHeight: 20 },
  warnCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14 },
  warnText: { fontSize: FontSizes.sm, fontFamily: INTER, color: Colors.textSecondary, lineHeight: 18 },
  continueBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  continueOff: { backgroundColor: '#C7CBD6' },
  sendBtn: { backgroundColor: Colors.coralDark },
  continueText: { fontSize: FontSizes.md, fontFamily: INTERB, fontWeight: '700', color: Colors.white },
});
