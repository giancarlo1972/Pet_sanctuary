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
import SignInPrompt from '@/components/SignInPrompt';

const SPECIES = ['dog', 'cat', 'rabbit', 'bird', 'other'] as const;
type Species = (typeof SPECIES)[number];

function speciesLabel(k: string) {
  return k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Pet';
}

export default function BookService() {
  const { user, loading: authLoading } = useAuth();
  const { providerId, service } = useLocalSearchParams<{ providerId?: string; service?: string }>();
  const [name, setName] = useState('Provider');
  const [offered, setOffered] = useState<string[]>(['sitter']);
  const [svc, setSvc] = useState(service || 'sitter');
  const [pets, setPets] = useState<{ id: string; name: string; species: string | null }[]>([]);
  const [species, setSpecies] = useState<Species>('dog');
  const [sharePetId, setSharePetId] = useState<string | null>(null);
  const [when, setWhen] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  const isOwn = Boolean(user?.id && providerId && providerId === user.id);

  const load = useCallback(async () => {
    if (!providerId) return;
    const [{ data: p }, { data: sp }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', providerId).maybeSingle(),
      supabase.from('service_provider_profiles').select('services').eq('user_id', providerId).maybeSingle(),
    ]);
    setName((p as any)?.full_name || 'Provider');
    const list = ((sp as any)?.services || []) as string[];
    if (list.length) {
      setOffered(list);
      setSvc((prev) => (list.includes(prev) ? prev : list[0]));
    }
    if (user && providerId !== user.id) {
      const { data: owned } = await supabase.from('pets').select('id, name, species').eq('owner_id', user.id).limit(20);
      setPets((owned as any[]) || []);
    } else {
      setPets([]);
      setSharePetId(null);
    }
  }, [providerId, user]);
  useEffect(() => { load(); }, [load]);

  const pickShare = (id: string | null) => {
    setSharePetId(id);
    if (id) {
      const pet = pets.find((x) => x.id === id);
      const sp = (pet?.species || '').toLowerCase();
      if (SPECIES.includes(sp as Species)) setSpecies(sp as Species);
    }
  };

  const send = async () => {
    if (!user) { router.push('/auth'); return; }
    if (!providerId) { setBanner({ kind: 'error', message: 'Missing provider.' }); return; }
    if (providerId === user.id) { setBanner({ kind: 'error', message: 'This is your listing — others request you from here.' }); return; }
    const start = when.trim() ? new Date(when.trim()) : new Date(Date.now() + 864e5);
    if (Number.isNaN(start.getTime())) { setBanner({ kind: 'error', message: 'Use a date like 2026-09-12 10:00.' }); return; }
    const body = note.trim() || null;
    setBusy(true);
    const row: Record<string, unknown> = {
      provider_id: providerId,
      client_id: user.id,
      pet_id: sharePetId,
      service: svc,
      species,
      starts_at: start.toISOString(),
      note: body,
      status: 'requested',
    };
    let { error } = await supabase.from('service_bookings').insert(row);
    if (error && /species/.test(error.message || '')) {
      const { species: _drop, ...rest } = row;
      const retry = await supabase.from('service_bookings').insert({
        ...rest,
        note: [speciesLabel(species), body].filter(Boolean).join(' · ') || null,
      });
      error = retry.error;
    }
    if (!error && sharePetId) {
      await supabase.from('pet_relationships').insert({
        pet_id: sharePetId,
        user_id: providerId,
        relationship: 'caretaker',
        started_on: new Date().toISOString().slice(0, 10),
      });
    }
    setBusy(false);
    if (error) { setBanner({ kind: 'error', message: error.message || 'Could not request booking.' }); return; }
    router.replace('/(tabs)/profile');
  };

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
        <AppHeader title="Request booking" showBack />
        {authLoading ? null : (
          <SignInPrompt title="Sign in to book" message="Sitters, walkers, and trainers take requests from signed-in members." />
        )}
      </SafeAreaView>
    );
  }

  if (isOwn) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
        <AppHeader title="Your listing" showBack />
        <Page>
          <Text style={s.h}>{name}</Text>
          <Text style={s.meta}>This is the listing others use to request you. Your pets stay private on Me.</Text>
          <Text style={s.label}>You offer</Text>
          <View style={s.chips}>
            {offered.map((k) => (
              <View key={k} style={[s.chip, s.chipOn]}>
                <Text style={s.chipTxtOn}>{PROVIDER_SERVICES.find((x) => x.key === k)?.label || k}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.cta} onPress={() => router.push('/service-provider')} activeOpacity={0.85}>
            <Text style={s.ctaTxt}>Edit services</Text>
          </TouchableOpacity>
        </Page>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
      <AppHeader title="Request booking" showBack />
      <Page>
        {banner ? <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} /> : null}
        <Text style={s.h}>{name}</Text>
        <Text style={s.label}>Service</Text>
        <View style={s.chips}>
          {offered.map((k) => (
            <TouchableOpacity key={k} style={[s.chip, svc === k && s.chipOn]} onPress={() => setSvc(k)} activeOpacity={0.85}>
              <Text style={[s.chipTxt, svc === k && s.chipTxtOn]}>{PROVIDER_SERVICES.find((x) => x.key === k)?.label || k}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Animal</Text>
        <Text style={s.meta}>Your pets stay private. Share Dog or Cat for the request — names stay off this listing until you share a profile.</Text>
        <View style={s.chips}>
          {SPECIES.map((k) => (
            <TouchableOpacity key={k} style={[s.chip, species === k && s.chipOn]} onPress={() => setSpecies(k)} activeOpacity={0.85}>
              <Text style={[s.chipTxt, species === k && s.chipTxtOn]}>{speciesLabel(k)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>Share a pet profile (optional)</Text>
        <Text style={s.meta}>Only if this person should see the record — meds, notes, photos.</Text>
        <View style={s.chips}>
          <TouchableOpacity style={[s.chip, !sharePetId && s.chipOn]} onPress={() => pickShare(null)} activeOpacity={0.85}>
            <Text style={[s.chipTxt, !sharePetId && s.chipTxtOn]}>{speciesLabel(species)} only</Text>
          </TouchableOpacity>
          {pets.map((p) => (
            <TouchableOpacity key={p.id} style={[s.chip, sharePetId === p.id && s.chipOn]} onPress={() => pickShare(p.id)} activeOpacity={0.85}>
              <Text style={[s.chipTxt, sharePetId === p.id && s.chipTxtOn]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>When</Text>
        <TextInput style={s.input} value={when} onChangeText={setWhen} placeholder="2026-09-12 10:00" placeholderTextColor={Colors.textTertiary} />
        <Text style={s.label}>Note</Text>
        <TextInput
          style={s.input}
          value={note}
          onChangeText={setNote}
          placeholder={sharePetId ? 'House notes, meds, gate code…' : 'Pickup, drop-off, crate, medical notes…'}
          placeholderTextColor={Colors.textTertiary}
          multiline
        />
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
  meta: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginTop: 4 },
  cta: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  ctaTxt: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white },
});
