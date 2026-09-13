import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { InlineBanner } from '@/components/InlineBanner';
import { CAMPAIGN_SELECT, typeForKind } from '@/lib/campaigns';

const INTER = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.regular;
const INTERB = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.bold;

const KINDS = [
  { key: 'petition', label: 'Petition' },
  { key: 'fundraising', label: 'Fundraiser' },
  { key: 'event', label: 'Event' },
  { key: 'awareness', label: 'Awareness' },
];

export default function CampaignNew() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [kind, setKind] = useState('petition');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [why, setWhy] = useState('');
  const [target, setTarget] = useState('');
  const [goal, setGoal] = useState('');
  const [tags, setTags] = useState('');
  const [cover, setCover] = useState('');
  const [status, setStatus] = useState('draft');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from('campaigns').select(CAMPAIGN_SELECT).eq('id', id).maybeSingle();
      if (!data) return;
      const row: any = data;
      setKind(row.kind === 'fundraiser' ? 'fundraising' : (row.kind || 'petition'));
      setTitle(row.title || '');
      setBody(row.body_md || row.body || '');
      setWhy(row.why_it_matters || '');
      setTarget(row.target || '');
      setGoal(String(row.kind === 'petition' ? (row.goal_count || '') : (row.goal_amount || '')));
      setTags((row.tags || []).join(', '));
      setCover(row.cover_url || '');
      setStatus(row.status || 'draft');
    })();
  }, [id]);

  const payload = (nextStatus: string) => {
    const tagArr = tags.split(/[#,\s]+/).map((t) => t.trim()).filter(Boolean);
    const n = goal.trim() ? Number(goal) : null;
    const isPetition = kind === 'petition';
    return {
      manager_id: user!.id,
      kind,
      type: typeForKind(kind),
      title: title.trim(),
      body: body.trim() || null,
      body_md: body.trim() || null,
      why_it_matters: why.trim() || null,
      target: target.trim() || null,
      tags: tagArr,
      cover_url: cover.trim() || null,
      goal_count: isPetition ? n : null,
      goal_amount: isPetition ? null : n,
      status: nextStatus,
    };
  };

  const persist = async (nextStatus: string) => {
    if (!user) { router.push('/auth'); return; }
    if (!title.trim()) { setBanner({ kind: 'error', message: 'Give the campaign a title.' }); return; }
    setBusy(true);
    const row = payload(nextStatus);
    let savedId = id || null;
    if (id) {
      const { error } = await supabase.from('campaigns').update(row).eq('id', id);
      if (error) {
        const slim = { manager_id: row.manager_id, kind: row.kind, title: row.title, body: row.body, goal_amount: row.goal_amount, status: row.status };
        const retry = await supabase.from('campaigns').update(slim).eq('id', id);
        if (retry.error) { setBusy(false); setBanner({ kind: 'error', message: retry.error.message || 'Could not save.' }); return; }
      }
    } else {
      const { data, error } = await supabase.from('campaigns').insert(row).select('id').maybeSingle();
      if (error) {
        const slim = { manager_id: row.manager_id, kind: row.kind, title: row.title, body: row.body, goal_amount: row.goal_amount, status: row.status };
        const retry = await supabase.from('campaigns').insert(slim).select('id').maybeSingle();
        if (retry.error) { setBusy(false); setBanner({ kind: 'error', message: retry.error.message || 'Could not create campaign.' }); return; }
        savedId = (retry.data as any)?.id || null;
      } else {
        savedId = (data as any)?.id || null;
      }
    }
    setBusy(false);
    if (savedId) router.replace(`/campaign-details?id=${savedId}`);
    else router.replace('/(tabs)/profile');
  };

  const isPetition = kind === 'petition';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
      <AppHeader title={id ? 'Edit campaign' : 'Start a campaign'} showBack />
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
        <TextInput style={[s.input, s.area]} value={body} onChangeText={setBody} placeholder="Full text" placeholderTextColor={Colors.textTertiary} multiline />
        {isPetition ? (
          <>
            <TextInput style={[s.input, s.area]} value={why} onChangeText={setWhy} placeholder="Why it matters" placeholderTextColor={Colors.textTertiary} multiline />
            <TextInput style={s.input} value={target} onChangeText={setTarget} placeholder="Target (legislator, agency, company)" placeholderTextColor={Colors.textTertiary} />
            <TextInput style={s.input} value={goal} onChangeText={setGoal} placeholder="Signature goal (e.g. 25000)" placeholderTextColor={Colors.textTertiary} keyboardType="number-pad" />
            <TextInput style={s.input} value={tags} onChangeText={setTags} placeholder="Tags (WhiteCoat, Congress)" placeholderTextColor={Colors.textTertiary} />
          </>
        ) : (
          <TextInput style={s.input} value={goal} onChangeText={setGoal} placeholder="Goal amount (optional)" placeholderTextColor={Colors.textTertiary} keyboardType="decimal-pad" />
        )}
        <TextInput style={s.input} value={cover} onChangeText={setCover} placeholder="Cover image URL (optional)" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
        <TouchableOpacity style={s.cta} onPress={() => persist(status === 'active' ? 'active' : 'draft')} disabled={busy}>
          {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={s.ctaTxt}>{id ? 'Save' : 'Save draft'}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={s.secondary} onPress={() => persist('active')} disabled={busy}>
          <Text style={s.secondaryTxt}>{status === 'active' ? 'Keep published' : 'Publish'}</Text>
        </TouchableOpacity>
      </Page>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.white },
  chipOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  chipTxt: { fontFamily: INTERB, fontSize: 13, color: Colors.navy, fontWeight: '700' },
  chipTxtOn: { color: Colors.white },
  input: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: INTER, color: Colors.navy, backgroundColor: Colors.white,
  },
  area: { minHeight: 88, textAlignVertical: 'top' },
  cta: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  ctaTxt: { fontFamily: INTERB, fontSize: 16, color: Colors.white, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: Colors.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  secondaryTxt: { fontFamily: INTERB, fontSize: 15, color: Colors.navy, fontWeight: '700' },
});
