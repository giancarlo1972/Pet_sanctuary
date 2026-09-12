import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { InlineBanner } from '@/components/InlineBanner';
import { pickImage } from '@/lib/pick-image';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { geocodePlace, reverseGeocode } from '@/lib/geocode';
import { encodeGeohash } from '@/lib/geohash';

const SPECIES_OPTIONS = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Other'];
const TNR = [
  { key: 'unknown', label: 'Unknown' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'done', label: 'Done · ear-tip' },
] as const;

type RelKey = 'owner' | 'foster' | 'sponsor' | 'community';

export default function AddPetScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Dog');
  const [breed, setBreed] = useState('');
  const [ageText, setAgeText] = useState('');
  const [gender, setGender] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [relationship, setRelationship] = useState<RelKey>('owner');
  const [territory, setTerritory] = useState('');
  const [feeding, setFeeding] = useState('');
  const [tnr, setTnr] = useState<'unknown' | 'scheduled' | 'done'>('unknown');
  const [colonyName, setColonyName] = useState('');
  const [geoHash, setGeoHash] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [ai, setAi] = useState<any>(null);
  const [photoFile, setPhotoFile] = useState<any>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  const isCommunity = relationship === 'community';

  const pickPhoto = async () => {
    if (!user) { setBanner({ message: 'Please sign in to add a pet.', kind: 'error' }); return; }
    setAnalyzing(true); setBanner(null);
    try {
      const picked = await pickImage();
      if (!picked) { setAnalyzing(false); return; }
      const blob = picked.blob;
      const pendingPath = `${user.id}/pending-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('pet-photos').upload(pendingPath, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      setPhotoPath(pendingPath);
      setPhotoFile(typeof File !== 'undefined' ? new File([blob], 'pet.jpg', { type: 'image/jpeg' }) : blob);
      const res = await fetch('/api/analyze-pet-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: picked.dataUrl }) });
      const json = await res.json();
      if (!json.analyzed) throw new Error(json.error || 'AI could not read the photo.');
      setAi(json);
      if (json.species) setSpecies(json.species);
      if (json.breed_guess) setBreed(json.breed_guess);
      if (json.life_stage) setAgeText(json.life_stage);
    } catch (e: any) {
      setBanner({ message: e.message || 'Photo analysis failed.', kind: 'error' });
    }
    setAnalyzing(false);
  };

  const hashFromQuery = async (q: string) => {
    const loc = await geocodePlace(q);
    if (!loc) return null;
    return encodeGeohash(loc.lat, loc.lng, 5);
  };

  const useMyArea = async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setBanner({ message: 'Location is not available in this browser.', kind: 'error' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const hash = encodeGeohash(pos.coords.latitude, pos.coords.longitude, 5);
        setGeoHash(hash);
        const rev = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        const label = [rev?.city, rev?.stateCode || rev?.state].filter(Boolean).join(', ');
        if (label) setTerritory(label);
        setLocating(false);
      },
      () => {
        setBanner({ message: 'Could not read your area. Type a neighborhood instead.', kind: 'error' });
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 },
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setBanner({ message: 'Pet name is required.', kind: 'error' }); return; }
    if (!user) { setBanner({ message: 'Please sign in to add a pet.', kind: 'error' }); return; }
    if (isCommunity && !territory.trim()) {
      setBanner({ message: 'Community pets need an approximate territory (neighborhood or city — never an exact pin).', kind: 'error' });
      return;
    }
    setLoading(true);
    setBanner(null);
    try {
      let hash = geoHash;
      const area = (isCommunity ? territory : location).trim();
      if (isCommunity && !hash && area) hash = await hashFromQuery(area);

      let colonyId: string | null = null;
      if (isCommunity && colonyName.trim()) {
        const { data: col } = await supabase.from('pet_colonies').insert({
          name: colonyName.trim(),
          territory: area || null,
          geohash: hash,
          created_by: user.id,
        }).select('id').maybeSingle();
        colonyId = col?.id || null;
      }

      const row: any = {
        name: name.trim(),
        species: species.toLowerCase(),
        breed: breed.trim() || null,
        age_text: ageText.trim() || null,
        gender: gender.trim() || null,
        description: description.trim() || null,
        location: isCommunity ? null : (location.trim() || null),
        is_public: false,
        availability: relationship === 'foster' ? 'foster' : 'none',
        status: isCommunity ? 'community' : 'private',
        listing_type: isCommunity ? 'community' : 'private',
        owner_id: user.id,
        main_photo_url: photoPath,
        ai_traits: ai ? { ...ai, confirmed: true } : null,
      };
      if (isCommunity) {
        row.territory = territory.trim();
        row.geohash = hash;
        row.feeding_schedule = feeding.trim() || null;
        row.tnr_status = tnr;
        row.colony_id = colonyId;
      }
      const { data, error } = await supabase.from('pets').insert(row).select('id').single();
      if (error) throw error;
      if (photoPath) {
        const dest = `${data.id}/${Date.now()}.jpg`;
        const moved = await supabase.storage.from('pet-photos').move(photoPath, dest);
        const stored = moved.error ? photoPath : dest;
        if (moved.error) console.warn('[add-pet] move photo', moved.error.message);
        await supabase.from('pets').update({ main_photo_url: stored }).eq('id', data.id);
        await supabase.from('pet_photos').insert({
          pet_id: data.id, photo_url: stored, is_profile: true, sort_order: 0, uploaded_by: user.id,
        });
      } else if (photoFile) {
        const path = `${data.id}/${Date.now()}.jpg`;
        const { error: upErr } = await supabase.storage.from('pet-photos').upload(path, photoFile, { contentType: photoFile.type || 'image/jpeg', upsert: true });
        if (upErr) throw upErr;
        await supabase.from('pets').update({ main_photo_url: path }).eq('id', data.id);
        await supabase.from('pet_photos').insert({
          pet_id: data.id, photo_url: path, is_profile: true, sort_order: 0, uploaded_by: user.id,
        });
      }
      await supabase.from('pet_relationships').insert({
        pet_id: data.id,
        user_id: user.id,
        relationship: isCommunity ? 'caretaker' : relationship,
        started_on: new Date().toISOString().slice(0, 10),
      });
      router.replace(`/pet-record?petId=${data.id}`);
    } catch (err: any) {
      setBanner({ message: err.message || 'Could not add pet. Please try again.', kind: 'error' });
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Add a Pet" showBack />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Page>
          <Text style={styles.sectionLabel}>Relationship</Text>
          <View style={styles.speciesRow}>
            {([['owner', 'My pet'], ['foster', 'Foster pet'], ['sponsor', 'Sponsored pet'], ['community', 'Community pet I care for']] as const).map(([k, l]) => (
              <TouchableOpacity
                key={k}
                style={[styles.speciesPill, relationship === k && styles.speciesPillActive]}
                onPress={() => {
                  setRelationship(k);
                  if (k === 'community' && species === 'Dog') setSpecies('Cat');
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.speciesPillText, relationship === k && styles.speciesPillTextActive]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {isCommunity ? (
            <Text style={styles.hint}>You are the caretaker. Location is stored as a geohash-5 area — never an exact pin. Medical records work the same as owned pets.</Text>
          ) : null}

          <Text style={styles.sectionLabel}>Photo · AI guess</Text>
          <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto} disabled={analyzing} activeOpacity={0.85}>
            {analyzing ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>{ai ? 'Re-analyze photo' : 'Upload photo for AI traits'}</Text>}
          </TouchableOpacity>
          {ai ? (
            <View style={styles.aiBox}>
              <Text style={styles.aiNote}>AI visual guess, not DNA — tap a chip to keep it.</Text>
              <View style={styles.speciesRow}>
                {ai.species ? <View style={styles.aiChip}><Text style={styles.aiChipTxt}>{ai.species}</Text></View> : null}
                {ai.breed_guess ? <View style={[styles.aiChip, styles.aiChipTeal]}><Text style={styles.aiChipTealTxt}>AI guess: {ai.breed_guess}{ai.confidence ? ` · ${Math.round(ai.confidence * 100)}%` : ''}</Text></View> : null}
                {ai.life_stage ? <View style={styles.aiChip}><Text style={styles.aiChipTxt}>{ai.life_stage}</Text></View> : null}
                {(ai.colors || []).map((c: string) => <View key={c} style={styles.aiChip}><Text style={styles.aiChipTxt}>{c}</Text></View>)}
                {ai.coat ? <View style={styles.aiChip}><Text style={styles.aiChipTxt}>{ai.coat} coat</Text></View> : null}
              </View>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Pet name" placeholderTextColor={Colors.textTertiary} />

          <Text style={styles.sectionLabel}>Species</Text>
          <View style={styles.speciesRow}>
            {SPECIES_OPTIONS.map((s) => (
              <TouchableOpacity key={s} style={[styles.speciesPill, species === s && styles.speciesPillActive]} onPress={() => setSpecies(s)} activeOpacity={0.75}>
                <Text style={[styles.speciesPillText, species === s && styles.speciesPillTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Breed</Text>
          <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="Breed (if known)" placeholderTextColor={Colors.textTertiary} />

          <Text style={styles.sectionLabel}>Age</Text>
          <TextInput style={styles.input} value={ageText} onChangeText={setAgeText} placeholder="e.g. 3 years, 6 months" placeholderTextColor={Colors.textTertiary} />

          <Text style={styles.sectionLabel}>Gender</Text>
          <TextInput style={styles.input} value={gender} onChangeText={setGender} placeholder="Male / Female / Unknown" placeholderTextColor={Colors.textTertiary} />

          <Text style={styles.sectionLabel}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Tell us about this pet's personality, needs, and history..." placeholderTextColor={Colors.textTertiary} multiline numberOfLines={4} textAlignVertical="top" />

          {isCommunity ? (
            <>
              <Text style={styles.sectionLabel}>Territory · approximate *</Text>
              <TextInput
                style={styles.input}
                value={territory}
                onChangeText={(v) => { setTerritory(v); setGeoHash(null); }}
                placeholder="Neighborhood or city — never a street address"
                placeholderTextColor={Colors.textTertiary}
              />
              <TouchableOpacity style={styles.secondary} onPress={useMyArea} disabled={locating} activeOpacity={0.85}>
                {locating ? <ActivityIndicator color={Colors.navy} /> : <Text style={styles.secondaryTxt}>Use my approximate area</Text>}
              </TouchableOpacity>
              {geoHash ? <Text style={styles.hint}>Area saved as geohash {geoHash} (about 5 km). Exact coordinates are discarded.</Text> : null}

              <Text style={styles.sectionLabel}>Feeding schedule</Text>
              <TextInput style={styles.input} value={feeding} onChangeText={setFeeding} placeholder="e.g. evenings near the park gate" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.sectionLabel}>TNR · ear-tip</Text>
              <View style={styles.speciesRow}>
                {TNR.map((t) => (
                  <TouchableOpacity key={t.key} style={[styles.speciesPill, tnr === t.key && styles.speciesPillActive]} onPress={() => setTnr(t.key)} activeOpacity={0.75}>
                    <Text style={[styles.speciesPillText, tnr === t.key && styles.speciesPillTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Colony (optional)</Text>
              <TextInput style={styles.input} value={colonyName} onChangeText={setColonyName} placeholder="Group name if several cats share this territory" placeholderTextColor={Colors.textTertiary} />
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Location</Text>
              <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="City or area" placeholderTextColor={Colors.textTertiary} />
            </>
          )}

          <TouchableOpacity style={[styles.submitBtn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.submitText}>{isCommunity ? 'Add community pet' : 'Add Pet'}</Text>}
          </TouchableOpacity>
        </Page>
      </KeyboardAvoidingView>
      {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  sectionLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white, marginBottom: 10 },
  textArea: { minHeight: 100, paddingTop: 14 },
  speciesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  speciesPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  speciesPillActive: { borderColor: Colors.coral, backgroundColor: Colors.coralBg },
  speciesPillText: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.textSecondary },
  speciesPillTextActive: { color: Colors.coral, fontFamily: Fonts.bold },
  submitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  submitText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  btnDisabled: { opacity: 0.6 },
  photoBtn: { backgroundColor: Colors.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  aiBox: { backgroundColor: Colors.surface, borderRadius: 14, padding: 12, marginBottom: 8 },
  aiNote: { fontSize: 11, fontFamily: Fonts.regular, fontStyle: 'italic', color: Colors.textTertiary, marginBottom: 8 },
  aiChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  aiChipTeal: { borderColor: Colors.teal, backgroundColor: Colors.white },
  aiChipTxt: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
  aiChipTealTxt: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.teal },
  hint: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 18, marginBottom: 8 },
  secondary: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8, backgroundColor: Colors.white },
  secondaryTxt: { fontFamily: Fonts.bold, color: Colors.navy, fontSize: 13 },
});
