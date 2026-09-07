import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PawPrint, Building2, TriangleAlert, TrendingUp, Users, LifeBuoy } from 'lucide-react-native';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { InlineBanner } from '@/components/InlineBanner';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import SignedImage from '@/components/SignedImage';
import { isUsablePhoto } from '@/lib/photos';

type PetRow = { id: string; name: string | null; main_photo_url: string | null; species: string | null };
type Member = { user_id: string; role: string; profiles?: { full_name: string | null; email: string | null } | null };

export default function ManageScreen() {
  const { user, loading: authLoading, actingIsPlatform, actingIsOrgAdmin, actingAs } = useAuth();
  const router = useRouter();
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [myPets, setMyPets] = useState<PetRow[]>([]);
  const [orgPets, setOrgPets] = useState<PetRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [results, setResults] = useState<{ id: string; pet_name: string; status: string; applicant_name: string }[]>([]);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const fail = (e: any, fallback: string) => setBanner({ kind: 'error', message: e?.message || fallback });

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data: profile, error: pErr } = await supabase.from('profiles').select('role, email').eq('id', user.id).maybeSingle();
    if (pErr) fail(pErr, 'Could not load profile.');
    const r = (profile?.role || '').toLowerCase();
    setRole(r);
    const platform = actingIsPlatform;

    const { data: owned } = await supabase.from('pets').select('id, name, main_photo_url, species').eq('owner_id', user.id).limit(40);
    const { data: rels } = await supabase.from('pet_relationships').select('pet_id').eq('user_id', user.id).is('ended_on', null);
    const extraIds = (rels || []).map((x: any) => x.pet_id).filter((id: string) => !(owned || []).some((p) => p.id === id));
    let related: PetRow[] = [];
    if (extraIds.length) {
      const { data } = await supabase.from('pets').select('id, name, main_photo_url, species').in('id', extraIds);
      related = (data as PetRow[]) || [];
    }
    setMyPets(([...(owned || []), ...related]) as PetRow[]);

    const { data: mine } = await supabase.from('organization_members')
      .select('organization_id, role, organizations(id, name)').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
    const o = (mine as any)?.organizations;
    if (o?.id) {
      setOrg({ id: o.id, name: o.name });
      const [{ data: op }, { data: mem }, { data: apps }] = await Promise.all([
        supabase.from('pets').select('id, name, main_photo_url, species').eq('shelter_id', o.id).limit(40),
        supabase.from('organization_members').select('user_id, role').eq('organization_id', o.id),
        supabase.from('foster_applications').select('id, status, applicant_name, pet_id').order('created_at', { ascending: false }).limit(20),
      ]);
      setOrgPets((op as PetRow[]) || []);
      const memIds = ((mem as any[]) || []).map((m) => m.user_id);
      const { data: ppl } = memIds.length
        ? await supabase.from('profiles').select('id, full_name, email').in('id', memIds)
        : { data: [] as any[] };
      const pmap: Record<string, any> = {};
      (ppl || []).forEach((p: any) => { pmap[p.id] = p; });
      setMembers(((mem as any[]) || []).map((m) => ({ ...m, profiles: pmap[m.user_id] })));
      const petIds = [...new Set(((apps as any[]) || []).map((a) => a.pet_id).filter(Boolean))];
      const { data: named } = petIds.length
        ? await supabase.from('pets').select('id, name').in('id', petIds)
        : { data: [] as any[] };
      const nmap: Record<string, string> = {};
      (named || []).forEach((p: any) => { nmap[p.id] = p.name; });
      setResults(((apps as any[]) || []).map((a) => ({
        id: a.id, status: a.status, applicant_name: a.applicant_name || 'Applicant', pet_name: nmap[a.pet_id] || 'Pet',
      })));
    } else setOrg(null);

    setLoading(false);
  }, [user, actingIsPlatform]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const platform = actingIsPlatform;
  const showOrg = Boolean(org) && actingIsOrgAdmin && actingAs?.role !== 'member' && actingAs?.role !== 'pet_admin';

  const addOrgAdmin = async () => {
    const email = invite.trim().toLowerCase();
    if (!email || !org || !user) { setBanner({ kind: 'error', message: 'Enter the email of someone who already has an account.' }); return; }
    setBusy('admin');
    const { data: ppl, error: e1 } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
    if (e1 || !ppl) { fail(e1, 'No user with that email — they must sign up first.'); setBusy(null); return; }
    const { error: e2 } = await supabase.from('organization_members').upsert({ organization_id: org.id, user_id: ppl.id, role: 'admin' });
    setBusy(null);
    if (e2) { fail(e2, 'Could not add org admin.'); return; }
    setInvite('');
    setBanner({ kind: 'success', message: `Added ${email} as org admin.` });
    load();
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.wrap} edges={['top']}>
        <AppHeader title="Manage" showBack />
        <ActivityIndicator color={Colors.coral} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!user) {
    router.replace('/auth');
    return null;
  }

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <AppHeader title="Manage" showBack />
      <Page>
        {banner ? <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} /> : null}

        <Text style={styles.kicker}>My Pets</Text>
        {myPets.length === 0 ? <Text style={styles.meta}>No pets yet.</Text> : null}
        {myPets.map((p) => (
          <TouchableOpacity key={p.id} style={styles.row} onPress={() => router.push(`/pet-record?petId=${p.id}`)}>
            {isUsablePhoto(p.main_photo_url) ? <SignedImage path={p.main_photo_url} style={styles.thumb} /> : (
              <View style={[styles.thumb, styles.thumbFallback]}><PawPrint color={Colors.textTertiary} size={16} /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name || 'Unnamed'}</Text>
              <Text style={styles.meta}>{p.species || 'Pet'}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.ghost} onPress={() => router.push('/add-pet')}><Text style={styles.ghostTxt}>Add a pet</Text></TouchableOpacity>

        {showOrg ? (
          <>
            <Text style={styles.kicker}>My Organization · {org?.name}</Text>
            <Text style={styles.sub}>Pets</Text>
            {orgPets.length === 0 ? <Text style={styles.meta}>No org pets listed.</Text> : null}
            {orgPets.map((p) => (
              <TouchableOpacity key={p.id} style={styles.row} onPress={() => router.push(`/pet-record?petId=${p.id}`)}>
                <PawPrint color={Colors.navy} size={16} />
                <Text style={styles.name}>{p.name || 'Unnamed'}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.sub}>Members</Text>
            {members.map((m) => (
              <View key={m.user_id} style={styles.row}>
                <Building2 color={Colors.navy} size={16} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{m.profiles?.full_name || m.profiles?.email || 'Member'}</Text>
                  <Text style={styles.meta}>{m.role}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.sub}>Results</Text>
            {results.length === 0 ? <Text style={styles.meta}>No applications yet.</Text> : null}
            {results.map((r) => (
              <View key={r.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.applicant_name} · {r.pet_name}</Text>
                  <Text style={styles.meta}>{r.status}</Text>
                </View>
              </View>
            ))}
            <TextInput style={styles.input} value={invite} onChangeText={setInvite} placeholder="Add org admin by email" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="email-address" />
            <TouchableOpacity style={styles.primary} onPress={addOrgAdmin} disabled={busy === 'admin'}>
              <Text style={styles.primaryTxt}>{busy === 'admin' ? '…' : 'Add org admin'}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {platform ? (
          <>
            <Text style={styles.kicker}>Platform</Text>
            <Text style={styles.meta}>Search, filters, detail sheets, audit log. Hub only — not production yet.</Text>
            {[
              { key: 'pets', label: 'Pets', sub: 'Edit · reassign · hide · merge', Icon: PawPrint },
              { key: 'reports', label: 'Reports', sub: 'Severity · assign · resolve', Icon: TriangleAlert },
              { key: 'trends', label: 'Trends', sub: 'Needs · helpers · requests', Icon: TrendingUp },
              { key: 'members', label: 'Members', sub: 'Roles · verify · block', Icon: Users },
              { key: 'orgs', label: 'Organizations', sub: 'EIN · admins · RescueGroups', Icon: Building2 },
              { key: 'issues', label: 'Member issues', sub: 'Bugs · tickets · flags', Icon: LifeBuoy },
            ].map((s) => (
              <TouchableOpacity key={s.key} style={styles.row} onPress={() => router.push(`/platform?section=${s.key}` as any)}>
                <s.Icon color={Colors.navy} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.label}</Text>
                  <Text style={styles.meta}>{s.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.ghost} onPress={() => router.push('/platform' as any)}>
              <Text style={styles.ghostTxt}>Open platform home</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </Page>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 12, color: Colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 18, marginBottom: 8 },
  sub: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy, marginTop: 12, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, marginBottom: 8 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border, marginBottom: 8, gap: 4 },
  thumb: { width: 40, height: 40, borderRadius: 20 },
  thumbFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy },
  meta: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'web' ? 10 : 12, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white, marginBottom: 8 },
  primary: { backgroundColor: Colors.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
  primaryTxt: { color: Colors.white, fontFamily: Fonts.bold },
  ghost: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginBottom: 8, backgroundColor: Colors.white },
  ghostTxt: { fontFamily: Fonts.bold, color: Colors.navy },
  actions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  ok: { fontFamily: Fonts.bold, color: Colors.tealDark },
  no: { fontFamily: Fonts.bold, color: Colors.critical },
});
