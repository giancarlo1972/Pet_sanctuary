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

export default function ShareService() {
  const { user } = useAuth();
  const [mine, setMine] = useState<{ id: string; name: string }[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [service, setService] = useState('transport');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: mem } = await supabase.from('organization_members').select('organization_id, organizations(id, name)').eq('user_id', user.id);
    const list = ((mem || []) as any[]).map((m) => ({ id: m.organizations?.id || m.organization_id, name: m.organizations?.name || 'Organization' })).filter((o) => o.id);
    setMine(list);
    if (list[0]) setFromId(list[0].id);
    const { data: all } = await supabase.from('organizations').select('id, name').eq('status', 'approved').order('name').limit(80);
    setOrgs((all as any[]) || []);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!fromId || !toId) { setBanner({ kind: 'error', message: 'Pick both organizations.' }); return; }
    if (fromId === toId) { setBanner({ kind: 'error', message: 'Share with a different organization.' }); return; }
    setBusy(true);
    const { error } = await supabase.from('shared_services').insert({
      from_org_id: fromId, to_org_id: toId, service: service.trim() || 'transport', note: note.trim() || null, status: 'offered',
    });
    setBusy(false);
    if (error) { setBanner({ kind: 'error', message: error.message || 'Could not share.' }); return; }
    router.replace('/(tabs)/profile');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
      <AppHeader title="Share a service" showBack />
      <Page>
        {banner ? <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} /> : null}
        <Text style={s.label}>From your org</Text>
        <View style={s.chips}>
          {mine.map((o) => (
            <TouchableOpacity key={o.id} style={[s.chip, fromId === o.id && s.chipOn]} onPress={() => setFromId(o.id)}>
              <Text style={[s.chipTxt, fromId === o.id && s.chipTxtOn]}>{o.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.label}>To</Text>
        <View style={s.chips}>
          {orgs.filter((o) => o.id !== fromId).slice(0, 12).map((o) => (
            <TouchableOpacity key={o.id} style={[s.chip, toId === o.id && s.chipOn]} onPress={() => setToId(o.id)}>
              <Text style={[s.chipTxt, toId === o.id && s.chipTxtOn]}>{o.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={s.input} value={service} onChangeText={setService} placeholder="transport · foster network · clinic" placeholderTextColor={Colors.textTertiary} />
        <TextInput style={s.input} value={note} onChangeText={setNote} placeholder="Note" placeholderTextColor={Colors.textTertiary} />
        <TouchableOpacity style={s.cta} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={s.ctaTxt}>Share</Text>}
        </TouchableOpacity>
      </Page>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy, marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.white },
  chipOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipTxt: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy },
  chipTxtOn: { color: Colors.white },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.regular, color: Colors.navy, backgroundColor: Colors.white },
  cta: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaTxt: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white },
});
