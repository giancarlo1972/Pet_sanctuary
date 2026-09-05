import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { InlineBanner } from '@/components/InlineBanner';

const REPORT_TYPES = [
  { value: 'lost', label: 'Lost' },
  { value: 'stray', label: 'Stray' },
  { value: 'injured', label: 'Injured' },
  { value: 'emergency', label: 'Emergency' },
];
const SPECIES = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Wildlife', 'Livestock', 'Other'];
const STEPS = [
  { n: 1, label: 'Photo' },
  { n: 2, label: 'AI' },
  { n: 3, label: 'Confirm' },
  { n: 4, label: 'Send' },
];

type Draft = {
  species: string;
  breed_guess: string;
  suggested_report_type: string;
  short_description: string;
  analyzed: boolean;
};

const EMPTY_DRAFT: Draft = {
  species: 'Other',
  breed_guess: 'Unknown',
  suggested_report_type: 'stray',
  short_description: '',
  analyzed: false,
};

export default function LostStrayReportScreen() {
  const { prefillPetId } = useLocalSearchParams<{ prefillPetId?: string }>();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [reportType, setReportType] = useState('stray');
  const [species, setSpecies] = useState('Other');
  const [breed, setBreed] = useState('');
  const [description, setDescription] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  const applyDraft = (d: Draft) => {
    setDraft(d);
    setReportType(d.suggested_report_type || 'stray');
    setSpecies(d.species || 'Other');
    setBreed(d.breed_guess === 'Unknown' ? '' : (d.breed_guess || ''));
    setDescription(d.short_description || '');
  };

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.6, exif: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    const ex = asset.exif as Record<string, any> | null;
    const gpsLat = ex?.GPSLatitude ?? ex?.gpsLatitude;
    const gpsLng = ex?.GPSLongitude ?? ex?.gpsLongitude;
    if (typeof gpsLat === 'number' && typeof gpsLng === 'number') {
      setLat(gpsLat);
      setLng(gpsLng);
      setLocation(`Photo location (${gpsLat.toFixed(5)}, ${gpsLng.toFixed(5)})`);
    }
    setStep(2);
    runAnalyze(asset.uri);
  };

  const skipPhoto = () => {
    setPhotoUri(null);
    applyDraft(EMPTY_DRAFT);
    setStep(3);
  };

    const toJpegBase64 = async (uri: string) => {
    const blob = await (await fetch(uri)).blob();
    if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
      const bmp = await createImageBitmap(blob);
      const max = 1280;
      let w = bmp.width;
      let h = bmp.height;
      if (Math.max(w, h) > max) {
        const scale = max / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(bmp, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.7);
    }
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return `data:image/jpeg;base64,${btoa(binary)}`;
  };

  const runAnalyze = async (uri: string) => {
    setAnalyzing(true);
    setBanner(null);
    try {
      const buf = await (await fetch(uri)).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      const imageBase64 = await toJpegBase64(uri);
      const resp = await fetch('/api/analyze-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const json = await resp.json();
      applyDraft({
        species: json.species || 'Other',
        breed_guess: json.breed_guess || 'Unknown',
        suggested_report_type: json.suggested_report_type || 'stray',
        short_description: json.short_description || '',
        analyzed: !!json.analyzed,
      });
    } catch {
      applyDraft({ ...EMPTY_DRAFT, short_description: 'Could not analyze this photo. Please confirm the details yourself.' });
      setBanner({ message: 'AI is unavailable. Confirm type and species on the next screen.', kind: 'info' });
    }
    setAnalyzing(false);
  };

  const useMyLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setBanner({ message: 'Location is not available in this browser.', kind: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        setLocation(`Current location (${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`);
        setLocating(false);
      },
      () => {
        setBanner({ message: 'Could not get location. Type an address instead.', kind: 'error' });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const handleSubmit = async () => {
    if (!description.trim() || !location.trim()) {
      setBanner({ message: 'Description and location are required.', kind: 'error' });
      return;
    }
    setLoading(true);
    setBanner(null);
    try {
      let photoUrl: string | null = null;
      if (photoUri && !photoUri.startsWith('http')) {
        try {
          const buf = await (await fetch(photoUri)).arrayBuffer();
          const path = `reports/${Date.now()}.jpg`;
          const up = await supabase.storage.from('pet-photos').upload(path, buf, { contentType: 'image/jpeg', upsert: true });
          if (!up.error) photoUrl = supabase.storage.from('pet-photos').getPublicUrl(path).data.publicUrl;
        } catch { /* still save */ }
      }
      const extra = extraNotes.trim();
      const { data, error } = await supabase.from('reports').insert({
        report_type: reportType,
        severity: reportType === 'emergency' || reportType === 'injured' ? 'critical' : reportType === 'lost' ? 'urgent' : 'standard',
        animal_kind: species,
        breed: breed.trim() || null,
        description: description.trim() + (extra ? `\n\nMore info: ${extra}` : ''),
        location_address: location.trim(),
        latitude: lat ?? 0,
        longitude: lng ?? 0,
        contact_name: user?.email?.split('@')[0] || 'Anonymous',
        contact_email: user?.email || null,
        pet_id: prefillPetId || null,
        photo_url: photoUrl,
        extra_notes: extra || null,
        status: 'active',
      }).select('id').single();
      if (error) throw error;
      router.replace(`/report-details?id=${data.id}`);
    } catch (err: any) {
      setBanner({ message: err.message || 'Could not submit report.', kind: 'error' });
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => (step > 1 ? setStep(step - 1) : router.back())} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Report an Animal</Text>
        <Text style={styles.stepHint}>{step}/4</Text>
      </View>
      <View style={styles.tracker}>
        {STEPS.map((s) => (
          <View key={s.n} style={styles.trackerItem}>
            <View style={[styles.trackerDot, step >= s.n && styles.trackerDotOn]} />
            <Text style={[styles.trackerLabel, step === s.n && styles.trackerLabelOn]}>{s.label}</Text>
          </View>
        ))}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {step === 1 && (
            <>
              <Text style={styles.heroTitle}>Start with a photo</Text>
              <Text style={styles.heroSub}>We’ll suggest type, species, and a short description. You confirm before anything is saved.</Text>
              {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" /> : null}
              <TouchableOpacity style={styles.submitBtn} onPress={pickPhoto} activeOpacity={0.85}>
                <Text style={styles.submitText}>{photoUri ? 'Choose a different photo' : 'Add a photo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={skipPhoto} activeOpacity={0.85}>
                <Text style={styles.secondaryText}>Skip — I’ll type it</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" /> : null}
              {analyzing ? (
                <>
                  <ActivityIndicator color={Colors.coral} size="large" />
                  <Text style={styles.heroSub}>Looking at the photo…</Text>
                </>
              ) : (
                <>
                  <Text style={styles.heroTitle}>{draft.analyzed ? 'Suggested from the photo' : 'Couldn’t analyze'}</Text>
                  <Text style={styles.heroSub}>
                    {draft.species} · {draft.breed_guess} · {draft.suggested_report_type}
                  </Text>
                  {draft.short_description ? <Text style={styles.body}>{draft.short_description}</Text> : null}
                  <TouchableOpacity style={styles.submitBtn} onPress={() => setStep(3)} activeOpacity={0.85}>
                    <Text style={styles.submitText}>Confirm or edit</Text>
                  </TouchableOpacity>
                  {photoUri ? (
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => runAnalyze(photoUri)} activeOpacity={0.85}>
                      <Text style={styles.secondaryText}>Analyze again</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.sectionLabel}>Type of report</Text>
              <View style={styles.chipRow}>
                {REPORT_TYPES.map((t) => (
                  <TouchableOpacity key={t.value} style={[styles.chip, reportType === t.value && styles.chipOn]} onPress={() => setReportType(t.value)}>
                    <Text style={[styles.chipText, reportType === t.value && styles.chipTextOn]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionLabel}>Animal</Text>
              <View style={styles.chipRow}>
                {SPECIES.map((s) => (
                  <TouchableOpacity key={s} style={[styles.chip, species === s && styles.chipOn]} onPress={() => setSpecies(s)}>
                    <Text style={[styles.chipText, species === s && styles.chipTextOn]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionLabel}>Breed (optional)</Text>
              <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="e.g. Tabby, Lab mix" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.sectionLabel}>Short description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Two sentences a volunteer can use"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={() => {
                  if (!description.trim()) {
                    setBanner({ message: 'Please confirm a short description.', kind: 'error' });
                    return;
                  }
                  setStep(4);
                }}
              >
                <Text style={styles.submitText}>Looks right — next</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 4 && (
            <>
              <Text style={styles.sectionLabel}>Location *</Text>
              <TouchableOpacity style={styles.gpsBtn} onPress={useMyLocation} disabled={locating}>
                <MapPin color={Colors.white} size={16} />
                <Text style={styles.gpsText}>{locating ? 'Getting location…' : 'Use my location'}</Text>
              </TouchableOpacity>
              <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Address or area" placeholderTextColor={Colors.textTertiary} />
              {lat != null && lng != null && Platform.OS === 'web' ? (
                // @ts-ignore
                <iframe title="map" width="100%" height="180" style={{ border: 0, borderRadius: 12, marginBottom: 10 }} src={`https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`} />
              ) : null}
              <Text style={styles.sectionLabel}>Anything else? (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={extraNotes}
                onChangeText={setExtraNotes}
                placeholder="Collar, behavior, nearby clinic…"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
              <TouchableOpacity style={[styles.submitBtn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Submit report</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topTitle: { flex: 1, fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  stepHint: { width: 40, textAlign: 'right', fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  tracker: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  trackerItem: { flex: 1, alignItems: 'center' },
  trackerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border, marginBottom: 4 },
  trackerDotOn: { backgroundColor: Colors.coral },
  trackerLabel: { fontSize: FontSizes.xs, fontFamily: Fonts.medium, color: Colors.textTertiary },
  trackerLabelOn: { color: Colors.coral, fontFamily: Fonts.bold },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 60 },
  heroTitle: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 8, textAlign: 'center' },
  heroSub: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', marginBottom: 16 },
  body: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, marginBottom: 16, lineHeight: 22 },
  preview: { width: '100%', height: 220, borderRadius: 12, marginBottom: 16, backgroundColor: Colors.surface },
  sectionLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  chipOn: { borderColor: Colors.coral, backgroundColor: Colors.coralBg },
  chipText: { fontFamily: Fonts.semibold, color: Colors.text },
  chipTextOn: { color: Colors.coral },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white, marginBottom: 10 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.navy, borderRadius: 12, paddingVertical: 12, marginBottom: 10 },
  gpsText: { color: Colors.white, fontFamily: Fonts.bold, fontSize: FontSizes.sm },
  submitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  submitText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center' },
  secondaryText: { fontFamily: Fonts.semibold, color: Colors.textSecondary },
  btnDisabled: { opacity: 0.6 },
});
