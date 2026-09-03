import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { InlineBanner } from '@/components/InlineBanner';

export default function EditProfileScreen() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [xHandle, setXHandle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name || '');
          setLocation(data.location || '');
          setPhone(data.phone || '');
          setAddressStreet(data.address_street || '');
          setAddressCity(data.address_city || '');
          setAddressState(data.address_state || '');
          setAddressZip(data.address_zip || '');
          setFacebook(data.facebook || '');
          setInstagram(data.instagram || '');
          setXHandle(data.x_handle || '');
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setBanner(null);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName.trim() || null,
        location: location.trim() || null,
        phone: phone.trim() || null,
        address_street: addressStreet.trim() || null,
        address_city: addressCity.trim() || null,
        address_state: addressState.trim() || null,
        address_zip: addressZip.trim() || null,
        facebook: facebook.trim() || null,
        instagram: instagram.trim() || null,
        x_handle: xHandle.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);
      if (error) throw error;
      setBanner({ message: 'Profile updated successfully.', kind: 'success' });
      setTimeout(() => router.back(), 1000);
    } catch (err: any) {
      setBanner({ message: err.message || 'Could not update profile. Please try again.', kind: 'error' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.coral} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Edit Profile</Text>
        <TouchableOpacity style={styles.topBtn} onPress={handleSave} disabled={saving} activeOpacity={0.75}>
          {saving ? <ActivityIndicator color={Colors.coral} size="small" /> : <Text style={styles.saveBtn}>Save</Text>}
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionLabel}>Full name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor={Colors.textTertiary} />

          <Text style={styles.sectionLabel}>Location</Text>
          <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="City, State" placeholderTextColor={Colors.textTertiary} />

          <Text style={styles.sectionLabel}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor={Colors.textTertiary} keyboardType="phone-pad" />

          <Text style={styles.sectionLabel}>Address</Text>
          <TextInput style={styles.input} value={addressStreet} onChangeText={setAddressStreet} placeholder="Street address" placeholderTextColor={Colors.textTertiary} />
          <View style={styles.cityStateRow}>
            <TextInput style={[styles.input, styles.flex1]} value={addressCity} onChangeText={setAddressCity} placeholder="City" placeholderTextColor={Colors.textTertiary} />
            <TextInput style={[styles.input, styles.flex1]} value={addressState} onChangeText={setAddressState} placeholder="State" placeholderTextColor={Colors.textTertiary} />
          </View>
          <TextInput style={styles.input} value={addressZip} onChangeText={setAddressZip} placeholder="ZIP code" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />

          <Text style={styles.sectionLabel}>Social links</Text>
          <TextInput style={styles.input} value={facebook} onChangeText={setFacebook} placeholder="Facebook URL" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
          <TextInput style={styles.input} value={instagram} onChangeText={setInstagram} placeholder="Instagram handle" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
          <TextInput style={styles.input} value={xHandle} onChangeText={setXHandle} placeholder="X (Twitter) handle" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
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
  topBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  topTitle: { flex: 1, fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  saveBtn: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.coral },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 60 },
  sectionLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white, marginBottom: 10 },
  cityStateRow: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
});
