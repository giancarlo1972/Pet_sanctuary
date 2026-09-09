import React, { useState } from 'react';
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

const KINDS = [
  { key: 'fundraising', label: 'Fundraising' },
  { key: 'event', label: 'Event' },
  { key: 'awareness', label: 'Awareness' },
];

export default function CampaignNew() {
  const { user } = useAuth();
  const [kind, setKind] = useState('fundraising');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  const save = async () => {
    if (!user) { router.push('/auth'); return; }
    if (!title.trim()) { setBanner({ kind: 'error', message: 'Give the campaign a title.' }); return; }
    setBusy(true);
    const { error } = await supabase.from('campaigns').insert({
      manager_id: user.id,
      kind,
      title: title.trim(),
      body: body.trim() || null,
      goal_amount: goal ? Number(goal) : null,
      status: 'draft',
    });
    setBusy(false);
    if (error) { setBanner({ kind: 'error', message: error.message || 'Could not create campaign.' }); return; }
    router.replace('/(tabs)/profile');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
      <AppHeader title="Start a campaign" showBack />
      <Page>
        {banner ? <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} /> : null}
        <View style={s.chips}>
          {KINDS.map((k) => (
            <TouchableOpacity key={k.key} style={[s.chip, kind === k.key && s.chipOn]} onPress={() => setKind(k.key)}>
              <Text style={[s.chipTxt, kind === k.key && s.chipTxtOn]}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={Colors.textTertiary} />
        <TextInput style={s.input} value={body} onChangeText={setBody} placeholder="What this is for" placeholderTextColor={Colors.textTertiary} multiline />
        <TextInput style={s.input} value={goal} onChangeText={setGoal} placeholder="Goal amount (optional)" placeholderTextColor={Colors.textTertiary} keyboardType="decimal-pad" />
        <TouchableOpacity style={s.cta} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={s.ctaTxt}>Save draft</Text>}
        </TouchableOpacity>
      </Page>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.white },
  chipOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipTxt: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy },
  chipTxtOn: { color: Colors.white },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.regular, color: Colors.navy, backgroundColor: Colors.white },
  cta: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaTxt: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white },
});
