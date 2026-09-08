import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { InlineBanner } from '@/components/InlineBanner';
import { PROVIDER_SERVICES } from '@/lib/role-categories';
import SignInPrompt from '@/components/SignInPrompt';

export default function ServiceProviderSetup() {
  const { user, loading: authLoading } = useAuth();
  const [services, setServices] = useState<string[]>(['sitter']);
  const [bio, setBio] = useState('');
  const [rate, setRate] = useState('');
  const [radius, setRadius] = useState('10');
  const [showMap, setShowMap] = useState(true);
  const [avail, setAvail] = useState('Weekdays after 5 · weekends');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('service_provider_profiles').select('*').eq('user_id', user.id).maybeSingle();
    if (data) {
      setServices((data.services || []).length ? data.services : ['sitter']);
      setBio(data.bio || '');
      setRate(data.rate_text || '');
      setRadius(String(data.radius_mi || 10));
      setShowMap(Boolean(data.show_on_map));
      setAvail(typeof data.availability === 'string' ? data.availability : (data.availability?.note || 'Weekdays after 5 · weekends'));
    }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const toggle = (key: string) => setServices((s) => s.includes(key) ? s.filter((k) => k !== key) : [...s, key]);

  const save = async () => {
    if (!user) { router.push('/auth'); return; }
    if (!services.length) { setBanner({ kind: 'error', message: 'Pick at least one service.' }); return; }
    setBusy(true);
    const { error } = await supabase.from('service_provider_profiles').upsert({
      user_id: user.id,
      services,
      bio: bio.trim() || null,
      rate_text: rate.trim() || null,
      radius_mi: Math.max(1, Number(radius) || 10),
      show_on_map: showMap,
      availability: { note: avail.trim() },
    });
    setBusy(false);
    if (error) { setBanner({ kind: 'error', message: error.message || 'Could not save.' }); return; }
    router.replace('/(tabs)/profile');
  };

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
        <AppHeader title="Offer a service" showBack />
        {authLoading ? null : (
          <SignInPrompt title="Sign in to offer services" message="Sitters, walkers, and trainers list from a signed-in profile." />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
      <AppHeader title="Offer a service" showBack />
      <Page>
        {banner ? <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} /> : null}
        <Text style={s.kicker}>SERVICES</Text>
        <View style={s.wrapChips}>
          {PROVIDER_SERVICES.map((x) => {
            const on = services.includes(x.key);
            return (
              <TouchableOpacity key={x.key} style={[s.chip, on && s.chipOn]} onPress={() => toggle(x.key)}>
                <Text style={[s.chipTxt, on && s.chipTxtOn]}>{x.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.label}>Bio</Text>
        <TextInput style={s.input} value={bio} onChangeText={setBio} placeholder="About you and your pets" placeholderTextColor={Colors.textTertiary} multiline />
        <Text style={s.label}>Rate</Text>
        <TextInput style={s.input} value={rate} onChangeText={setRate} placeholder="$25 / walk · $40 / night" placeholderTextColor={Colors.textTertiary} />
        <Text style={s.label}>Radius (mi)</Text>
        <TextInput style={s.input} value={radius} onChangeText={setRadius} keyboardType="number-pad" />
        <Text style={s.label}>Availability</Text>
        <TextInput style={s.input} value={avail} onChangeText={setAvail} placeholder="Weekdays after 5" placeholderTextColor={Colors.textTertiary} />
        <TouchableOpacity style={s.cta} onPress={save} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={s.ctaTxt}>Save</Text>}
        </TouchableOpacity>
      </Page>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  kicker: { fontFamily: Fonts.extrabold, fontSize: 11, letterSpacing: 0.8, color: Colors.textTertiary, marginTop: 8 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.white },
  chipOn: { backgroundColor: Colors.teal, borderColor: Colors.teal },
  chipTxt: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy },
  chipTxtOn: { color: Colors.white },
  label: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy, marginTop: 8 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.regular, color: Colors.navy, backgroundColor: Colors.white },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cta: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  ctaTxt: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white },
});
