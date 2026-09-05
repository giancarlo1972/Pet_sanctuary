import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { InlineBanner } from '@/components/InlineBanner';

const REPORT_TYPES = [
  { value: 'lost', label: 'Lost Pet', desc: 'Your pet is missing', severity: 'urgent' },
  { value: 'stray', label: 'Found Stray', desc: 'You found a stray animal', severity: 'standard' },
  { value: 'injured', label: 'Injured Animal', desc: 'Animal needs medical help', severity: 'critical' },
  { value: 'road_accident', label: 'Road Accident', desc: 'Animal hit by vehicle', severity: 'critical' },
  { value: 'cruelty', label: 'Cruelty/Neglect', desc: 'Report abuse or neglect', severity: 'urgent' },
  { value: 'emergency', label: 'Emergency', desc: 'Immediate danger', severity: 'critical' },
];

const ANIMAL_KINDS = ['Dog', 'Cat', 'Rabbit', 'Bird', 'Wildlife', 'Livestock', 'Other'];
const BREEDS: Record<string, string[]> = {
  Dog: ['Unknown / Mix', 'Labrador', 'German Shepherd', 'Pit Bull', 'Golden Retriever', 'Poodle', 'Beagle', 'Chihuahua', 'Other'],
  Cat: ['Unknown / Mix', 'Domestic Shorthair', 'Domestic Longhair', 'Siamese', 'Maine Coon', 'Tabby', 'Other'],
};
  const STEPS = [
  { n: 1, label: 'Type' },
  { n: 2, label: 'Animal' },
  { n: 3, label: 'Place' },
   ];

export default function LostStrayReportScreen() {
  const { prefillPetId } = useLocalSearchParams<{ prefillPetId?: string }>();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [reportType, setReportType] = useState('lost');
  const [who, setWho] = useState<'me' | 'other' | 'found'>('me');
  const [petName, setPetName] = useState('');
  const [animalKind, setAnimalKind] = useState('Dog');
  const [breed, setBreed] = useState('Unknown / Mix');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [allowDirectContact, setAllowDirectContact] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [myPets, setMyPets] = useState<{ id: string; name: string; species: string | null; breed: string | null }[]>([]);
  const [pickedPetId, setPickedPetId] = useState<string | null>(prefillPetId || null);

  useEffect(() => {
    if (!user) return;
    supabase.from('pets').select('id, name, species, breed').eq('owner_id', user.id)
      .then(({ data }) => setMyPets((data as any) || []));
  }, [user]);
  
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
        setBanner({ message: 'Could not get location. Allow location access or type an address.', kind: 'error' });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const useMyAccount = () => {
    setContactEmail(user?.email || '');
    setContactName(user?.user_metadata?.full_name || user?.email?.split('@')[0] || '');
    setWho('me');
  };

  const nextFromStep1 = () => {
    if (who === 'me' && user) useMyAccount();
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!description.trim() || !location.trim()) {
      setBanner({ message: 'Please provide a description and location.', kind: 'error' });
      return;
    }

    setLoading(true);
    setBanner(null);
    const severity = REPORT_TYPES.find((t) => t.value === reportType)?.severity || 'standard';
    try {
      const { data, error } = await supabase.from('reports').insert({
        report_type: reportType,
        severity,
        pet_name: petName.trim() || null,
        animal_kind: animalKind.trim() || null,
        breed: breed.trim() || null,
        description: description.trim() + (who === 'other' ? '\n\n[Filed on behalf of someone else]' : who === 'found' ? '\n\n[Finder report]' : ''),
        location_address: location.trim(),
        latitude: lat ?? 0,
        longitude: lng ?? 0,
        contact_name: contactName.trim() || 'Anonymous',
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        allow_direct_contact: allowDirectContact,
        pet_id: pickedPetId || prefillPetId || null,
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
        <TouchableOpacity style={styles.topBtn} onPress={() => (step > 1 ? setStep(step - 1) : router.back())} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Report an Animal</Text>
      <Text style={styles.stepHint}>{step}/3</Text>
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
              <Text style={styles.sectionLabel}>What type of report?</Text>
              <View style={styles.typeGrid}>
                {REPORT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.typeCard, reportType === t.value && styles.typeCardActive]}
                    onPress={() => setReportType(t.value)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.typeLabel, reportType === t.value && styles.typeLabelActive]}>{t.label}</Text>
                    <Text style={styles.typeDesc}>{t.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionLabel}>Who is this about?</Text>
              <TouchableOpacity style={[styles.whoRow, who === 'me' && styles.whoActive]} onPress={() => setWho('me')}>
                <Text style={styles.whoTitle}>My pet / I am the owner</Text>
                <Text style={styles.whoSub}>We’ll use your login email on the report</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.whoRow, who === 'found' && styles.whoActive]} onPress={() => setWho('found')}>
                <Text style={styles.whoTitle}>I found this animal</Text>
                <Text style={styles.whoSub}>You are a finder, not the owner</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.whoRow, who === 'other' && styles.whoActive]} onPress={() => setWho('other')}>
                <Text style={styles.whoTitle}>Reporting for someone else</Text>
                <Text style={styles.whoSub}>You’ll enter their contact on the last step</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={nextFromStep1} activeOpacity={0.85}>
                <Text style={styles.submitText}>Continue</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.sectionLabel}>Pet details (optional)</Text>
                            {who === 'me' && myPets.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>Which pet?</Text>
                  {myPets.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.whoRow, pickedPetId === p.id && styles.whoActive]}
                      onPress={() => {
                        setPickedPetId(p.id);
                        setPetName(p.name);
                        const kind = (p.species || 'Dog');
                        const pretty = ANIMAL_KINDS.find((k) => k.toLowerCase() === kind.toLowerCase()) || 'Other';
                        setAnimalKind(pretty);
                        setBreed(p.breed || 'Unknown / Mix');
                      }}
                    >
                      <Text style={styles.whoTitle}>{p.name}</Text>
                      <Text style={styles.whoSub}>{[p.species, p.breed].filter(Boolean).join(' · ') || 'My pet'}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              ) : null}
              <TextInput style={styles.input} value={petName} onChangeText={setPetName} placeholder="Pet name" placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.sectionLabel}>Animal type</Text>
              <View style={styles.typeRow}>
                {ANIMAL_KINDS.map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.whoRow, animalKind === k && styles.whoActive, { marginBottom: 8 }]}
                    onPress={() => {
                      setAnimalKind(k);
                      setBreed((BREEDS[k] || ['Unknown / Mix'])[0]);
                    }}
                  >
                    <Text style={styles.whoTitle}>{k}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {BREEDS[animalKind] ? (
                <>
                  <Text style={styles.sectionLabel}>Breed</Text>
                  <View style={styles.typeRow}>
                    {BREEDS[animalKind].map((b) => (
                      <TouchableOpacity
                        key={b}
                        style={[styles.whoRow, breed === b && styles.whoActive, { marginBottom: 8 }]}
                        onPress={() => setBreed(b)}
                      >
                        <Text style={styles.whoTitle}>{b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}
              <Text style={styles.sectionLabel}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe the animal, situation, and any distinguishing features…"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
              <Text style={styles.sectionLabel}>Location *</Text>
              <TouchableOpacity style={styles.gpsBtn} onPress={useMyLocation} disabled={locating} activeOpacity={0.85}>
                <MapPin color={Colors.white} size={16} />
                <Text style={styles.gpsText}>{locating ? 'Getting location…' : 'Use my location'}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Address or area where the animal was seen"
                placeholderTextColor={Colors.textTertiary}
              />
            {lat != null && lng != null ? (
                Platform.OS === 'web' ? (
                  // @ts-ignore
                  <iframe
                    title="map"
                    width="100%"
                    height="200"
                    style={{ border: 0, borderRadius: 12, marginBottom: 10 }}
                    src={`https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
                  />
                ) : (
                  <Text style={{ marginBottom: 10, color: Colors.textSecondary }}>
                    Pin: {lat.toFixed(5)}, {lng.toFixed(5)}
                  </Text>
                )
              ) : null}
              <TouchableOpacity style={styles.submitBtn} onPress={() => {
                if (!description.trim() || !location.trim()) {
                  setBanner({ message: 'Description and location are required.', kind: 'error' });
                  return;
                }
                setStep(3);
              }} activeOpacity={0.85}>
                <Text style={styles.submitText}>Continue</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.sectionLabel}>Contact {who === 'other' ? '(the other person)' : '(optional)'}</Text>
              {user && who !== 'other' && (
                <TouchableOpacity style={styles.gpsBtn} onPress={useMyAccount} activeOpacity={0.85}>
                  <Text style={styles.gpsText}>Use my account info</Text>
                </TouchableOpacity>
              )}
              <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="Your name" placeholderTextColor={Colors.textTertiary} />
              <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} placeholder="Phone number" placeholderTextColor={Colors.textTertiary} keyboardType="phone-pad" />
              <TextInput style={styles.input} value={contactEmail} onChangeText={setContactEmail} placeholder="Email" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="email-address" />
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Allow direct contact from finders</Text>
                <Switch value={allowDirectContact} onValueChange={setAllowDirectContact} trackColor={{ true: Colors.coral }} />
              </View>
              <TouchableOpacity style={[styles.submitBtn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.submitText}>Submit Report</Text>}
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
  typeRow: { marginBottom: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topTitle: { flex: 1, fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  stepHint: { width: 40, textAlign: 'right', fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 60 },
  sectionLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  typeCard: { width: '48%', flexGrow: 1, backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: Colors.border },
  typeCardActive: { borderColor: Colors.coral, backgroundColor: Colors.coralBg },
  typeLabel: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 4 },
  typeLabelActive: { color: Colors.coral },
  typeDesc: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  whoRow: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8 },
  whoActive: { borderColor: Colors.navy, backgroundColor: Colors.surface },
  whoTitle: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text },
  whoSub: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white, marginBottom: 10 },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  gpsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.navy, borderRadius: 12, paddingVertical: 12, marginBottom: 10 },
  gpsText: { color: Colors.white, fontFamily: Fonts.bold, fontSize: FontSizes.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  switchLabel: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, flex: 1, marginRight: 12 },
  submitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  submitText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  btnDisabled: { opacity: 0.6 },
    tracker: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  trackerItem: { flex: 1, alignItems: 'center' },
  trackerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border, marginBottom: 4 },
  trackerDotOn: { backgroundColor: Colors.coral },
  trackerLabel: { fontSize: FontSizes.xs, fontFamily: Fonts.medium, color: Colors.textTertiary },
  trackerLabelOn: { color: Colors.coral, fontFamily: Fonts.bold },
  typeRow: { marginBottom: 8 },
});
