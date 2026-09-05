import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, PawPrint, Home, Heart } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { InlineBanner } from '@/components/InlineBanner';

export default function ApplicationScreen() {
  const { petId, type } = useLocalSearchParams<{ petId: string; type: string }>();
  const { user } = useAuth();
  const [pet, setPet] = useState<{ name: string; breed: string | null; species: string; main_photo_url: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [homeType, setHomeType] = useState('');
  const [experience, setExperience] = useState('');
  const [hasOtherPets, setHasOtherPets] = useState(false);
  const [homeVisitConsent, setHomeVisitConsent] = useState(false);
  const [signature, setSignature] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  useEffect(() => {
    if (!petId) return;
    supabase.from('pets').select('name, breed, species, main_photo_url').eq('id', petId).maybeSingle()
      .then(({ data }) => { if (data) setPet(data); })
      .finally(() => setLoading(false));
  }, [petId]);

  const handleSubmit = async () => {
    if (!user) { setBanner({ message: 'Please sign in to submit an application.', kind: 'error' }); return; }
    if (!petId) { setBanner({ message: 'Missing pet information.', kind: 'error' }); return; }
    if (!signature.trim()) { setBanner({ message: 'Please sign by typing your full name.', kind: 'error' }); return; }
    setSubmitting(true);
    setBanner(null);
    try {
      const { error } = await supabase.from('foster_applications').insert({
        pet_id: petId,
        applicant_id: user.id,
        application_type: type || 'foster',
        message: message.trim() || null,
        home_type: homeType.trim() || null,
        experience: experience.trim() || null,
        has_other_pets: hasOtherPets,
        home_visit_consent: homeVisitConsent,
        attestation_signed_name: signature.trim(),
        submitted_at: new Date().toISOString(),
        status: 'pending',
        answers: {},
      });
      if (error) throw error;
      setBanner({ message: 'Application submitted! The organization will review it shortly.', kind: 'success' });
      setTimeout(() => router.back(), 1500);
    } catch (err: any) {
      setBanner({ message: err.message || 'Could not submit application. Please try again.', kind: 'error' });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.coral} />
      </SafeAreaView>
    );
  }

  const appType = type === 'adopt' ? 'Adoption' : 'Foster';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{appType} Application</Text>
        <View style={styles.topBtn} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {pet && (
            <View style={styles.petCard}>
              <View style={styles.petIcon}><PawPrint color={Colors.coral} size={20} /></View>
              <View>
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petMeta}>{pet.breed ? `${pet.breed} · ` : ''}{pet.species}</Text>
              </View>
            </View>
          )}

          <Text style={styles.sectionLabel}>Why are you interested? (optional)</Text>
          <TextInput style={[styles.input, styles.textArea]} value={message} onChangeText={setMessage} placeholder="Tell the organization about yourself and why you'd be a great fit..." placeholderTextColor={Colors.textTertiary} multiline numberOfLines={4} textAlignVertical="top" />

          <Text style={styles.sectionLabel}>Home type</Text>
          <TextInput style={styles.input} value={homeType} onChangeText={setHomeType} placeholder="House, apartment, etc." placeholderTextColor={Colors.textTertiary} />

          <Text style={styles.sectionLabel}>Experience with animals</Text>
          <TextInput style={styles.input} value={experience} onChangeText={setExperience} placeholder="Years of experience, previous pets, etc." placeholderTextColor={Colors.textTertiary} />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>I have other pets</Text>
            <Switch value={hasOtherPets} onValueChange={setHasOtherPets} trackColor={{ true: Colors.coral, false: Colors.surfaceAlt }} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>I consent to a home visit</Text>
            <Switch value={homeVisitConsent} onValueChange={setHomeVisitConsent} trackColor={{ true: Colors.coral, false: Colors.surfaceAlt }} />
          </View>

          <Text style={styles.sectionLabel}>Signature *</Text>
          <Text style={styles.signatureNote}>Type your full name to sign this application.</Text>
          <TextInput style={styles.input} value={signature} onChangeText={setSignature} placeholder="Your full legal name" placeholderTextColor={Colors.textTertiary} />

          <TouchableOpacity style={[styles.submitBtn, submitting && styles.btnDisabled]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.submitText}>Submit Application</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  centered: { justifyContent: 'center', alignItems: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topTitle: { flex: 1, fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 60 },
  petCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  petIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.coralBg, justifyContent: 'center', alignItems: 'center' },
  petName: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text },
  petMeta: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  sectionLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white, marginBottom: 10 },
  textArea: { minHeight: 100, paddingTop: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  switchLabel: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textBody },
  signatureNote: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary, marginBottom: 8 },
  submitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  submitText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  btnDisabled: { opacity: 0.6 },
});
