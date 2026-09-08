import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { InlineBanner } from '@/components/InlineBanner';
import { PROVIDER_SERVICES } from '@/lib/role-categories';

export default function BookService() {
  const { user } = useAuth();
  const { providerId, service } = useLocalSearchParams<{ providerId?: string; service?: string }>();
  const [name, setName] = useState('Provider');
  const [offered, setOffered] = useState<string[]>(['sitter']);
  const [svc, setSvc] = useState(service || 'sitter');
  const [pets, setPets] = useState<{ id: string; name: string }[]>([]);
  const [petId, setPetId] = useState<string | null>(null);
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  const load = useCallback(async () => {
    if (!providerId) return;
    const [{ data: p }, { data: sp }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', providerId).maybeSingle(),
      supabase.from('service_provider_profiles').select('services').eq('user_id', providerId).maybeSingle(),
    ]);
    setName((p as any)?.full_name || 'Provider');
    const list = ((sp as any)?.services || []) as string[];
    if (list.length) { setOffered(list); if (!list.includes(svc)) setSvc(list[0]); }
    if (user) {
      const { data: owned } = await supabase.from('pets').select('id, name').eq('owner_id', user.id).limit(20);
      setPets((owned as any[]) || []);
      if (owned?.[0]) setPetId(owned[0].id);
    }
  }, [providerId, user, svc]);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!user) { router.push('/auth'); return; }
    if (!providerId) { setBanner({ kind: 'error', message: 'Missing provider.' }); return; }
    const start = when.trim() ? new Date(when.trim()) : new Date(Date.now() + 864e5);
    if (Number.isNaN(start.getTime())) { setBanner({ kind: 'error', message: 'Use a date like 2026-09-12 10:00.' }); return; }
    setBusy(true);
    const { error } = await supabase.from('service_bookings').insert({
      provider_id: providerId,
      client_id: user.id,
      pet_id: petId,
      service: svc,
      starts_at: start.toISOString(),
      note: note.trim() || null,
      status: 'requested',
    });
    setBusy(false);
    if (error) { setBanner({ kind: 'error', message: error.message || 'Could not request booking.' }); return; }
    router.replace('/(tabs)/profile');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
      <AppHeader title="Request booking" showBack />
      <Page>
        {banner ? <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} /> : null}
        <Text style={s.h}>{name}</Text>
        <Text style={s.label}>Service</Text>
        <View style={s.chips}>
          {offered.map((k) => (
            <TouchableOpacity key={k} style={[s.chip, svc === k && s.chipOn]} onPress={() => setSvc(k)}>
              <Text style={[s.chipTxt, svc === k && s.chipTxtOn]}>{PROVIDER_SERVICES.find((x) => x.key === k)?.label || k}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.label}>Pet</Text>
        <View style={s.chips}>
          {pets.map((p) => (
            <TouchableOpacity key={p.id} style={[s.chip, petId === p.id && s.chipOn]} onPress={() => setPetId(p.id)}>
              <Text style={[s.chipTxt, petId === p.id && s.chipTxtOn]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {pets.length === 0 ? <Text style={s.meta}>Add a pet first so the sitter knows who they are booking for.</Text> : null}
        <Text style={s.label}>When</Text>
        <TextInput style={s.input} value={when} onChangeText={setWhen} placeholder="2026-09-12 10:00" placeholderTextColor={Colors.textTertiary} />
        <Text style={s.label}>Note</Text>
        <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="House notes, meds, gate code…" placeholderTextColor={Colors.textTertiary} multiline />
        <TouchableOpacity style={s.cta} onPress={send} disabled={busy} activeOpacity={0.85}>
          {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={s.ctaTxt}>Request booking</Text>}
        </TouchableOpacity>
      </Page>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  h: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.navy, marginTop: 8 },
  label: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.white },
  chipOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipTxt: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy },
  chipTxtOn: { color: Colors.white },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.regular, color: Colors.navy, backgroundColor: Colors.white },
  meta: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary },
  cta: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  ctaTxt: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white },
});
