import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { Page } from '@/components/Page';
import { InlineBanner } from '@/components/InlineBanner';
import { ROLE_CARDS, normalizeCategories, type RoleCategory } from '@/lib/role-categories';

export default function OnboardingScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ add?: string }>();
  const adding = params.add === '1';
  const [picked, setPicked] = useState<RoleCategory[]>(['owner']);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('role_categories').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (data?.role_categories) setPicked(normalizeCategories(data.role_categories));
    });
  }, [user]);

  const toggle = (key: RoleCategory) => {
    setPicked((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  };

  const save = async () => {
    if (!picked.length || !user) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({
      role_categories: picked,
      onboarding_done: true,
      pet_owner_active: picked.includes('owner'),
    }).eq('id', user.id);
    if (error) {
      setBanner({ kind: 'error', message: error.message || 'Could not save. Run the role-categories SQL in Supabase first.' });
      setBusy(false);
      return;
    }
    if (picked.includes('provider')) {
      await supabase.from('service_provider_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id' });
    }
    if (picked.includes('organization')) {
      router.replace('/register-organization');
      return;
    }
    if (picked.includes('provider')) {
      router.replace('/service-provider');
      return;
    }
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={s.wrap} edges={['top']}>
      <Page>
        <Text style={s.step}>STEP 2 OF 2</Text>
        <Text style={s.h1}>How will you use Rescue Army?</Text>
        <Text style={s.lead}>Pick every role that fits. You can add another later from Me.</Text>
        {banner ? <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} /> : null}
        {ROLE_CARDS.map((c) => {
          const on = picked.includes(c.key);
          return (
            <TouchableOpacity
              key={c.key}
              style={[s.card, on && { borderColor: Colors.coral, borderWidth: 2 }]}
              onPress={() => toggle(c.key)}
              activeOpacity={0.85}
            >
              <View style={[s.tile, { backgroundColor: c.tile }]}>
                <Text style={[s.mark, { color: c.color }]}>{c.mark}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.titleRow}>
                  <Text style={s.title}>{c.title}</Text>
                  {on ? (
                    <View style={s.check}>
                      <Check color={Colors.white} size={12} />
                    </View>
                  ) : null}
                </View>
                <Text style={s.desc}>{c.description}</Text>
                <View style={s.chips}>
                  {c.chips.map((ch) => (
                    <View key={ch} style={s.chip}><Text style={s.chipTxt}>{ch}</Text></View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[s.cta, (!picked.length || busy) && { opacity: 0.5 }]}
          disabled={!picked.length || busy}
          onPress={save}
          activeOpacity={0.85}
        >
          {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={s.ctaTxt}>Continue</Text>}
        </TouchableOpacity>
        <Text style={s.foot}>Organizations and Campaign managers go through verification before their tools unlock.</Text>
        {adding ? (
          <TouchableOpacity onPress={() => router.back()} style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={s.link}>Cancel</Text>
          </TouchableOpacity>
        ) : null}
      </Page>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  step: { fontFamily: Fonts.extrabold, fontSize: 11, letterSpacing: 0.8, color: Colors.coral, marginTop: 8 },
  h1: { fontFamily: Fonts.extrabold, fontSize: 26, color: Colors.navy, marginTop: 4 },
  lead: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  card: {
    flexDirection: 'row', gap: 12, backgroundColor: Colors.white, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border, padding: 14, alignItems: 'flex-start',
  },
  tile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mark: { fontFamily: Fonts.extrabold, fontSize: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.navy, flex: 1 },
  check: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.coral, alignItems: 'center', justifyContent: 'center' },
  desc: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipTxt: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.navy },
  cta: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  ctaTxt: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white },
  foot: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textTertiary, textAlign: 'center', lineHeight: 18 },
  link: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy },
});
