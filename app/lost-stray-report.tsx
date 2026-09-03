import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, MapPin, PawPrint, Camera, AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { InlineBanner } from '@/components/InlineBanner';

const REPORT_TYPES = [
  { value: 'lost', label: 'Lost Pet', desc: 'Your pet is missing' },
  { value: 'stray', label: 'Found Stray', desc: 'You found a stray animal' },
  { value: 'injured', label: 'Injured Animal', desc: 'Animal needs medical help' },
  { value: 'road_accident', label: 'Road Accident', desc: 'Animal hit by vehicle' },
  { value: 'cruelty', label: 'Cruelty/Neglect', desc: 'Report abuse or neglect' },
  { value: 'emergency', label: 'Emergency', desc: 'Immediate danger' },
];

export default function LostStrayReportScreen() {
  const { prefillPetId } = useLocalSearchParams<{ prefillPetId?: string }>();
  const { user } = useAuth();
  const [reportType, setReportType] = useState('lost');
  const [petName, setPetName] = useState('');
  const [animalKind, setAnimalKind] = useState('');
  const [breed, setBreed] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [allowDirectContact, setAllowDirectContact] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  const handleSubmit = async () => {
    if (!description.trim() || !location.trim()) {
      setBanner({ message: 'Please provide a description and location.', kind: 'error' });
      return;
    }
    if (!user) {
      setBanner({ message: 'Please sign in to submit a report.', kind: 'error' });
      return;
    }
    setLoading(true);
    setBanner(null);
    try {
      const { data, error } = await supabase.from('reports').insert({
        report_type: reportType,
        pet_name: petName.trim() || null,
        animal_kind: animalKind.trim() || null,
        breed: breed.trim() || null,
        description: description.trim(),
        location_address: location.trim(),
        latitude: 0,
        longitude: 0,
        contact_name: contactName.trim() || null,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        allow_direct_contact: allowDirectContact,
        pet_id: prefillPetId || null,
        status: 'active',
      }).select('id').single();
      if (error) throw error;
      router.replace(`/report-details?id=${data.id}`);
    } catch (err: any) {
      setBanner({ message: err.message || 'Could not submit report. Please try again.', kind: 'error' });
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Report an Animal</Text>
        <View style={styles.topBtn} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionLabel}>What type of report?</Text>
          <View style={styles.typeGrid}>
            {REPORT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeCard, reportType === t.value && styles.typeCardActive]}
                onPress={() => setReportType(t.value)}
                activeOpacity={0.75}
              >
                <Text style={[styles.typeCardLabel, reportType === t.value && styles.typeCardLabelActive]}>{t.label}</Text>
                <Text style={styles.typeCardDesc}>{t.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Pet details (optional)</Text>
          <TextInput style={styles.input} value={petName} onChangeText={setPetName} placeholder="Pet name" placeholderTextColor={Colors.textTertiary} />
          <TextInput style={styles.input} value={animalKind} onChangeText={setAnimalKind} placeholder="Animal type (dog, cat, etc.)" placeholderTextColor={Colors.textTertiary} />
          <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="Breed (if known)" placeholderTextColor={Colors.textTertiary} />

          <Text style={styles.sectionLabel}>Description *</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Describe the animal, situation, and any distinguishing features..." placeholderTextColor={Colors.textTertiary} multiline numberOfLines={4} textAlignVertical="top" />

          <Text style={styles.sectionLabel}>Location *</Text>
          <View style={styles.locationRow}>
            <MapPin color={Colors.textTertiary} size={18} />
            <TextInput style={styles.locationInput} value={location} onChangeText={setLocation} placeholder="Address or area where the animal was seen" placeholderTextColor={Colors.textTertiary} />
          </View>

          <Text style={styles.sectionLabel}>Your contact (optional)</Text>
          <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="Your name" placeholderTextColor={Colors.textTertiary} />
          <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} placeholder="Phone number" placeholderTextColor={Colors.textTertiary} keyboardType="phone-pad" />
          <TextInput style={styles.input} value={contactEmail} onChangeText={setContactEmail} placeholder="Email" placeholderTextColor={Colors.textTertiary} keyboardType="email-address" />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Allow direct contact from finders</Text>
            <Switch value={allowDirectContact} onValueChange={setAllowDirectContact} trackColor={{ true: Colors.coral, false: Colors.surfaceAlt }} />
          </View>

          <TouchableOpacity style={[styles.submitBtn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.submitText}>Submit Report</Text>}
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
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeCard: { width: '48%', backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: Colors.border },
  typeCardActive: { borderColor: Colors.coral, backgroundColor: Colors.coralBg },
  typeCardLabel: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 4 },
  typeCardLabelActive: { color: Colors.coral },
  typeCardDesc: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white, marginBottom: 10 },
  textArea: { minHeight: 100, paddingTop: 14 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, backgroundColor: Colors.white, marginBottom: 10 },
  locationInput: { flex: 1, paddingVertical: 14, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  switchLabel: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textBody },
  submitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  submitText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  btnDisabled: { opacity: 0.6 },
});
