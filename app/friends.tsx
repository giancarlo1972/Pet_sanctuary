import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { ChevronRight, User, Building2, PawPrint } from 'lucide-react-native';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import SignInPrompt from '@/components/SignInPrompt';

const INTER = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.regular;
const INTER7 = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.bold;
const INTER8 = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.extrabold;

type Row = { key: string; title: string; sub: string; href?: string };

export default function FriendsScreen() {
  const { user, loading: authLoading } = useAuth();
  const [people, setPeople] = useState<Row[]>([]);
  const [orgs, setOrgs] = useState<Row[]>([]);
  const [access, setAccess] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data: fol } = await supabase.from('follows').select('target_type, target_id, created_at').eq('follower_id', user.id);
    const userIds = (fol || []).filter((f: any) => f.target_type === 'user').map((f: any) => f.target_id);
    const orgIds = (fol || []).filter((f: any) => f.target_type === 'organization').map((f: any) => f.target_id);
    const [{ data: ppl }, { data: orgRows }] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id, full_name, email').in('id', userIds) : { data: [] as any[] },
      orgIds.length ? supabase.from('organizations').select('id, name, org_type, city').in('id', orgIds) : { data: [] as any[] },
    ]);
    setPeople((ppl || []).map((p: any) => ({
      key: p.id, title: p.full_name || p.email || 'Member', sub: 'Person you follow',
    })));
    setOrgs((orgRows || []).map((o: any) => ({
      key: o.id, title: o.name, sub: [o.org_type, o.city].filter(Boolean).join(' · ') || 'Organization',
      href: `/organization-details?id=${o.id}`,
    })));

    const { data: owned } = await supabase.from('pets').select('id, name').eq('owner_id', user.id);
    const myPetIds = (owned || []).map((p: any) => p.id);
    let rels: any[] = [];
    const mine = await supabase
      .from('pet_relationships')
      .select('id, pet_id, user_id, relationship, ended_on')
      .eq('user_id', user.id)
      .is('ended_on', null);
    rels = (mine.data || []) as any[];
    if (myPetIds.length) {
      const others = await supabase
        .from('pet_relationships')
        .select('id, pet_id, user_id, relationship, ended_on')
        .in('pet_id', myPetIds)
        .is('ended_on', null);
      const seenRel = new Set(rels.map((r) => r.id));
      for (const r of others.data || []) if (!seenRel.has(r.id)) rels.push(r);
    }
    const otherIds = [...new Set((rels || []).map((r: any) => r.user_id).filter((id: string) => id !== user.id))];
    const petMap: Record<string, string> = {};
    (owned || []).forEach((p: any) => { petMap[p.id] = p.name; });
    const extraPetIds = [...new Set((rels || []).map((r: any) => r.pet_id).filter((id: string) => !petMap[id]))];
    if (extraPetIds.length) {
      const { data: extra } = await supabase.from('pets').select('id, name').in('id', extraPetIds);
      (extra || []).forEach((p: any) => { petMap[p.id] = p.name; });
    }
    const { data: names } = otherIds.length
      ? await supabase.from('profiles').select('id, full_name, email').in('id', otherIds)
      : { data: [] as any[] };
    const nmap: Record<string, string> = {};
    (names || []).forEach((p: any) => { nmap[p.id] = p.full_name || p.email || 'Member'; });
    const accessRows: Row[] = [];
    for (const r of rels || []) {
      if (r.user_id === user.id) {
        const rel = String(r.relationship || '').toLowerCase();
        if (rel === 'own' || rel === 'owner') continue;
        accessRows.push({
          key: r.id,
          title: nmap[r.user_id] ? nmap[r.user_id] : 'You',
          sub: `${rel.replace('_', ' ')} · ${petMap[r.pet_id] || 'Pet'}`,
          href: `/pet-record?petId=${r.pet_id}`,
        });
      } else {
        accessRows.push({
          key: r.id,
          title: nmap[r.user_id] || 'Member',
          sub: `${String(r.relationship || 'access').replace('_', ' ')} · ${petMap[r.pet_id] || 'Pet'}`,
          href: `/pet-record?petId=${r.pet_id}`,
        });
      }
    }
    const seen = new Set<string>();
    setAccess(accessRows.filter((r) => {
      const k = r.title + r.sub;
      if (seen.has(k)) return false;
      seen.add(k);
      return r.title !== 'You';
    }));
    setLoading(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unfollow = async (type: 'user' | 'organization', id: string) => {
    if (!user) return;
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('target_type', type).eq('target_id', id);
    load();
  };

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
        <AppHeader title="Friends" showBack />
        {authLoading ? null : (
          <SignInPrompt title="Sign in to see friends" message="People you follow, organizations, and pet access stay on your account." />
        )}
      </SafeAreaView>
    );
  }

  const Section = ({ title, rows, kind }: { title: string; rows: Row[]; kind?: 'user' | 'organization' }) => (
    <View style={{ gap: 8 }}>
      <Text style={s.kicker}>{title}</Text>
      {rows.length === 0 ? <Text style={s.empty}>None yet</Text> : rows.map((r) => (
        <TouchableOpacity
          key={r.key}
          style={s.row}
          onPress={() => r.href && router.push(r.href as any)}
          activeOpacity={r.href ? 0.85 : 1}
        >
          <View style={s.tile}>
            {kind === 'organization' ? <Building2 color="#fff" size={16} /> : kind === 'user' ? <User color="#fff" size={16} /> : <PawPrint color="#fff" size={16} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{r.title}</Text>
            <Text style={s.sub} numberOfLines={1}>{r.sub}</Text>
          </View>
          {kind ? (
            <TouchableOpacity onPress={() => unfollow(kind, r.key)} hitSlop={8}>
              <Text style={s.un}>Unfollow</Text>
            </TouchableOpacity>
          ) : <ChevronRight color="#9AA1AC" size={16} />}
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
      <AppHeader title="Friends" showBack />
      <Page>
        <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {loading ? <ActivityIndicator color={Colors.coral} style={{ marginTop: 24 }} /> : (
            <>
              <Section title="People you follow" rows={people} kind="user" />
              <Section title="Organizations you follow" rows={orgs} kind="organization" />
              <Section title="People with pet access" rows={access} />
            </>
          )}
        </ScrollView>
      </Page>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  kicker: { fontFamily: INTER8, fontWeight: '800', fontSize: 11, letterSpacing: 0.8, color: '#9AA1AC' },
  empty: { fontFamily: INTER, fontSize: 13, color: '#6B7280' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff',
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#EEF0F4',
  },
  tile: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#26265E', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: INTER7, fontWeight: '700', fontSize: 14, color: '#26265E' },
  sub: { fontFamily: INTER, fontSize: 12, color: '#6B7280', marginTop: 1 },
  un: { fontFamily: INTER7, fontWeight: '700', fontSize: 12, color: '#E85A50' },
});
