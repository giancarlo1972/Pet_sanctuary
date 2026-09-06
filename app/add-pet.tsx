import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, PawPrint } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { InlineBanner } from '@/components/InlineBanner';

const SPECIES_OPTIONS = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Other'];

export default function AddPetScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Dog');
  const [breed, setBreed] = useState('');
  const [ageText, setAgeText] = useState('');
  const [gender, setGender] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isPublic, setIsPublic] = useState(true);
    const [availability, setAvailability] = useState('available');
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) { setBanner({ message: 'Pet name is required.', kind: 'error' }); return; }
    if (!user) { setBanner({ message: 'Please sign in to add a pet.', kind: 'error' }); return; }
    setLoading(true);
    setBanner(null);
    try {
      const { data, error } = await supabase.from('pets').insert({
        name: name.trim(),
        species: species.toLowerCase(),
        breed: breed.trim() || null,
        age_text: ageText.trim() || null,
        gender: gender.trim() || null,
        description: description.trim() || null,
        location: location.trim() || null,
        is_public: isPublic,
        availability,
      }).select('id').single();
      if (error) throw error;
      router.replace(`/pet-details?id=${data.id}`);
    } catch (err: any) {
      setBanner({ message: err.message || 'Could not add pet. Please try again.', kind: 'error' });
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Add a Pet</Text>
        <View style={styles.topBtn} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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

          <Text style={styles.sectionLabel}>Location</Text>
          <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="City or area" placeholderTextColor={Colors.textTertiary} />

          <Text style={styles.sectionLabel}>Availability</Text>
          <View style={styles.availRow}>
            {['available', 'foster', 'both'].map((a) => (
              <TouchableOpacity key={a} style={[styles.availPill, availability === a && styles.availPillActive]} onPress={() => setAvailability(a)} activeOpacity={0.75}>
                <Text style={[styles.availPillText, availability === a && styles.availPillTextActive]}>{a === 'available' ? 'Adoption' : a === 'foster' ? 'Foster' : 'Both'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Visible to public</Text>
            <Switch value={isPublic} onValueChange={setIsPublic} trackColor={{ true: Colors.coral, false: Colors.surfaceAlt }} />
          </View>

          <TouchableOpacity style={[styles.submitBtn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.submitText}>Add Pet</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topTitle: { flex: 1, fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 60 },
  sectionLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white, marginBottom: 10 },
  textArea: { minHeight: 100, paddingTop: 14 },
  speciesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  speciesPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  speciesPillActive: { borderColor: Colors.coral, backgroundColor: Colors.coralBg },
  speciesPillText: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.textSecondary },
  speciesPillTextActive: { color: Colors.coral, fontFamily: Fonts.bold },
  availRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  availPill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  availPillActive: { borderColor: Colors.coral, backgroundColor: Colors.coralBg },
  availPillText: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.textSecondary },
  availPillTextActive: { color: Colors.coral, fontFamily: Fonts.bold },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  switchLabel: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textBody },
  submitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  submitText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  btnDisabled: { opacity: 0.6 },
});
