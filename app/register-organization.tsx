import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Building2 } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { InlineBanner } from '@/components/InlineBanner';

const ORG_TYPES = [
  { value: 'shelter', label: 'Animal Shelter' },
  { value: 'rescue_group', label: 'Rescue Group' },
  { value: 'veterinary_clinic', label: 'Veterinary Clinic' },
  { value: 'sponsor', label: 'Sponsor / Business' },
];

export default function RegisterOrganizationScreen() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [orgType, setOrgType] = useState('shelter');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [website, setWebsite] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [ein, setEin] = useState('');
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) { setBanner({ message: 'Organization name is required.', kind: 'error' }); return; }
    if (!user) { setBanner({ message: 'Please sign in to register an organization.', kind: 'error' }); return; }
    setLoading(true);
    setBanner(null);
    try {
      const { data, error } = await supabase.from('organizations').insert({
        name: name.trim(),
        org_type: orgType,
        description: description.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        website: website.trim() || null,
        contact_email: contactEmail.trim() || null,
        phone: phone.trim() || null,
        ein: ein.trim() || null,
        created_by: user.id,
        status: 'pending',
        ein_verified: false,
        tax_deductible: false,
        donations_enabled: false,
      }).select('id').single();
      if (error) throw error;
      setBanner({ message: 'Organization registered! It will be reviewed by our team.', kind: 'success' });
      setTimeout(() => router.replace(`/organization-details?id=${data.id}`), 1500);
    } catch (err: any) {
      setBanner({ message: err.message || 'Could not register organization. Please try again.', kind: 'error' });
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Register Organization</Text>
        <View style={styles.topBtn} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}><Building2 color={Colors.coral} size={32} /></View>
            <Text style={styles.heroTitle}>Register your organization</Text>
            <Text style={styles.heroSubtitle}>Join Rescue Army to list pets, accept applications, and receive support.</Text>
          </View>

          <Text style={styles.sectionLabel}>Organization name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Happy Tails Rescue" placeholderTextColor={Colors.textTertiary} />

          <Text style={styles.sectionLabel}>Type</Text>
          <View style={styles.typeRow}>
            {ORG_TYPES.map((t) => (
              <TouchableOpacity key={t.value} style={[styles.typePill, orgType === t.value && styles.typePillActive]} onPress={() => setOrgType(t.value)} activeOpacity={0.75}>
                <Text style={[styles.typePillText, orgType === t.value && styles.typePillTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Tell us about your organization's mission..." placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} textAlignVertical="top" />

          <Text style={styles.sectionLabel}>Address</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Street address" placeholderTextColor={Colors.textTertiary} />
          <View style={styles.cityStateRow}>
            <TextInput style={[styles.input, styles.flex1]} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor={Colors.textTertiary} />
            <TextInput style={[styles.input, styles.flex1]} value={state} onChangeText={setState} placeholder="State" placeholderTextColor={Colors.textTertiary} />
          </View>

          <Text style={styles.sectionLabel}>Website</Text>
          <TextInput style={styles.input} value={website} onChangeText={setWebsite} placeholder="https://..." placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />

          <Text style={styles.sectionLabel}>Contact email</Text>
          <TextInput style={styles.input} value={contactEmail} onChangeText={setContactEmail} placeholder="contact@org.org" placeholderTextColor={Colors.textTertiary} keyboardType="email-address" autoCapitalize="none" />

          <Text style={styles.sectionLabel}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor={Colors.textTertiary} keyboardType="phone-pad" />

          <Text style={styles.sectionLabel}>EIN (for 501(c)(3) verification)</Text>
          <TextInput style={styles.input} value={ein} onChangeText={setEin} placeholder="XX-XXXXXXX" placeholderTextColor={Colors.textTertiary} />

          <TouchableOpacity style={[styles.submitBtn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.submitText}>Submit Registration</Text>}
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
  hero: { alignItems: 'center', marginBottom: 24 },
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.coralBg, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  heroTitle: { fontSize: FontSizes.xl, fontFamily: Fonts.extrabold, color: Colors.text, marginBottom: 6 },
  heroSubtitle: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  sectionLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white, marginBottom: 10 },
  textArea: { minHeight: 80, paddingTop: 14 },
  cityStateRow: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typePill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.border },
  typePillActive: { borderColor: Colors.coral, backgroundColor: Colors.coralBg },
  typePillText: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.textSecondary },
  typePillTextActive: { color: Colors.coral, fontFamily: Fonts.bold },
  submitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
  submitText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  btnDisabled: { opacity: 0.6 },
});
