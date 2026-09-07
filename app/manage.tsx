import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PawPrint, Building2 } from 'lucide-react-native';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { InlineBanner } from '@/components/InlineBanner';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { isPlatformAdmin } from '@/lib/admin-access';
import SignedImage from '@/components/SignedImage';
import { isUsablePhoto } from '@/lib/photos';

type PetRow = { id: string; name: string | null; main_photo_url: string | null; species: string | null };
type Member = { user_id: string; role: string; profiles?: { full_name: string | null; email: string | null } | null };
type IdRow = { user_id: string; id_status: string | null; id_document_path: string | null; profiles?: { full_name: string | null; email: string | null } | null };

export default function ManageScreen() {
  const { user, loading: authLoading } = useAuth();
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
  const [orgsQ, setOrgsQ] = useState<{ id: string; name: string; status: string | null }[]>([]);
  const [idsQ, setIdsQ] = useState<IdRow[]>([]);
  const [queue, setQueue] = useState<{ id: string; subject_type: string; flag_reason: string | null; status: string }[]>([]);
  const [bugs, setBugs] = useState<{ id: string; title: string | null; body: string | null; status: string }[]>([]);
  const [people, setPeople] = useState<{ id: string; email: string | null; full_name: string | null; role: string | null; blocked: boolean | null }[]>([]);
  const [peopleQ, setPeopleQ] = useState('');
  const [uploadEmail, setUploadEmail] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [supportEmail, setSupportEmail] = useState('support.animals@rescue-army.com');
  const [maintenance, setMaintenance] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const fail = (e: any, fallback: string) => setBanner({ kind: 'error', message: e?.message || fallback });

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data: profile, error: pErr } = await supabase.from('profiles').select('role, email').eq('id', user.id).maybeSingle();
    if (pErr) fail(pErr, 'Could not load profile.');
    const r = (profile?.role || '').toLowerCase();
    setRole(r);
    const platform = isPlatformAdmin(r, user.email || profile?.email);

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

    if (platform) {
      const { data: pendingOrgs } = await supabase.from('organizations').select('id, name, status')
        .in('status', ['pending', 'submitted', 'review', 'pending_review']).limit(40);
      setOrgsQ((pendingOrgs as any) || []);
      const { data: ids } = await supabase.from('user_verifications')
        .select('user_id, id_status, id_document_path').in('id_status', ['submitted', 'pending']).limit(40);
      const uids = ((ids as any[]) || []).map((i) => i.user_id);
      const { data: names } = uids.length
        ? await supabase.from('profiles').select('id, full_name, email').in('id', uids)
        : { data: [] as any[] };
      const nmap: Record<string, any> = {};
      (names || []).forEach((p: any) => { nmap[p.id] = p; });
      setIdsQ(((ids as any[]) || []).map((i) => ({ ...i, profiles: nmap[i.user_id] })));
      const { data: q } = await supabase.from('moderation_queue').select('id, subject_type, flag_reason, status').eq('status', 'pending').limit(40);
      setQueue((q as any) || []);
      const { data: b } = await supabase.from('bug_reports').select('id, title, body, status').order('created_at', { ascending: false }).limit(30);
      setBugs((b as any) || []);
      const { data: mems } = await supabase.from('profiles').select('id, email, full_name, role, blocked').order('email').limit(80);
      if (mems) setPeople(mems as any);
      else {
        const { data: mems2 } = await supabase.from('profiles').select('id, email, full_name, role').order('email').limit(80);
        setPeople(((mems2 || []) as any).map((m: any) => ({ ...m, blocked: false })));
      }
      const { data: settings } = await supabase.from('app_settings').select('key, value');
      (settings || []).forEach((s: any) => {
        if (s.key === 'support_email') setSupportEmail(String(s.value || '').replace(/^"|"$/g, ''));
        if (s.key === 'maintenance_message') setMaintenance(String(s.value || '').replace(/^"|"$/g, ''));
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const platform = isPlatformAdmin(role, user?.email);

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

  const decideOrg = async (id: string, status: string) => {
    const { error } = await supabase.from('organizations').update({ status }).eq('id', id);
    if (error) fail(error, 'Could not update organization.');
    else { setBanner({ kind: 'success', message: `Org ${status}.` }); load(); }
  };

  const decideId = async (userId: string, ok: boolean) => {
    const { error } = await supabase.from('user_verifications').update({
      id_status: ok ? 'approved' : 'rejected',
      id_verified: ok,
    }).eq('user_id', userId);
    if (error) fail(error, 'Could not update ID.');
    else { setBanner({ kind: 'success', message: ok ? 'ID approved.' : 'ID rejected.' }); load(); }
  };

  const decideQueue = async (id: string, status: string) => {
    const { error } = await supabase.from('moderation_queue').update({ status }).eq('id', id);
    if (error) fail(error, 'Could not update queue.');
    else load();
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

        {org ? (
          <>
            <Text style={styles.kicker}>My Organization · {org.name}</Text>
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
            <Text style={styles.sub}>Approvals — orgs / IDs / responders</Text>
            {orgsQ.map((o) => (
              <View key={o.id} style={styles.card}>
                <Text style={styles.name}>{o.name}</Text>
                <Text style={styles.meta}>{o.status}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => decideOrg(o.id, 'approved')}><Text style={styles.ok}>Approve</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => decideOrg(o.id, 'rejected')}><Text style={styles.no}>Reject</Text></TouchableOpacity>
                </View>
              </View>
            ))}
            {idsQ.map((i) => (
              <View key={i.user_id} style={styles.card}>
                <Text style={styles.name}>{i.profiles?.full_name || i.profiles?.email || 'User'} · Government ID</Text>
                <Text style={styles.meta}>{i.id_status}{i.id_document_path ? ` · ${i.id_document_path}` : ''}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => decideId(i.user_id, true)}><Text style={styles.ok}>Approve</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => decideId(i.user_id, false)}><Text style={styles.no}>Reject</Text></TouchableOpacity>
                </View>
              </View>
            ))}
            {orgsQ.length === 0 && idsQ.length === 0 ? <Text style={styles.meta}>No pending approvals.</Text> : null}

            <Text style={styles.sub}>Support — upload / block / reset</Text>
            <TextInput style={styles.input} value={peopleQ} onChangeText={setPeopleQ} placeholder="Search members" placeholderTextColor={Colors.textTertiary} />
            {people.filter((m) => `${m.email || ''} ${m.full_name || ''}`.toLowerCase().includes(peopleQ.toLowerCase())).slice(0, 20).map((m) => (
              <View key={m.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{m.full_name || m.email}</Text>
                  <Text style={styles.meta}>{m.role || 'member'}{m.blocked ? ' · blocked' : ''}</Text>
                </View>
                <TouchableOpacity onPress={async () => {
                  const { error } = await supabase.from('profiles').update({ blocked: !m.blocked }).eq('id', m.id);
                  if (error) fail(error, 'Could not update block.'); else load();
                }}><Text style={m.blocked ? styles.ok : styles.no}>{m.blocked ? 'Unblock' : 'Block'}</Text></TouchableOpacity>
              </View>
            ))}
            <TextInput style={styles.input} value={uploadEmail} onChangeText={setUploadEmail} placeholder="Upload for user (email)" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            <TouchableOpacity style={styles.ghost} onPress={async () => {
              const email = uploadEmail.trim().toLowerCase();
              if (!email) { setBanner({ kind: 'error', message: 'Enter a user email first.' }); return; }
              const { data: ppl, error: e1 } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
              if (e1 || !ppl) { fail(e1, 'No user with that email.'); return; }
              const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
              if (pick.canceled || !pick.assets?.[0]) { setBanner({ kind: 'info', message: 'Upload canceled.' }); return; }
              const blob = await (await fetch(pick.assets[0].uri)).blob();
              const path = `${ppl.id}/admin-${Date.now()}.jpg`;
              const { error: up } = await supabase.storage.from('identity-docs').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
              if (up) { fail(up, 'Upload failed.'); return; }
              const { error: uv } = await supabase.from('user_verifications').upsert({ user_id: ppl.id, id_document_path: path, id_status: 'submitted', id_verified: false });
              if (uv) fail(uv, 'Saved file but could not mark submitted.');
              else setBanner({ kind: 'success', message: 'Uploaded for user.' });
              load();
            }}><Text style={styles.ghostTxt}>Upload for user</Text></TouchableOpacity>
            <TextInput style={styles.input} value={resetEmail} onChangeText={setResetEmail} placeholder="Reset password (email)" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            <TouchableOpacity style={styles.ghost} onPress={async () => {
              const email = resetEmail.trim().toLowerCase();
              if (!email) { setBanner({ kind: 'error', message: 'Enter an email to send a reset.' }); return; }
              const { error } = await supabase.auth.resetPasswordForEmail(email);
              if (error) fail(error, 'Could not send reset.');
              else setBanner({ kind: 'success', message: `Reset email sent to ${email}.` });
            }}><Text style={styles.ghostTxt}>Send password reset</Text></TouchableOpacity>

            <Text style={styles.sub}>Moderation & reviews</Text>
            {queue.length === 0 ? <Text style={styles.meta}>Queue clear.</Text> : null}
            {queue.map((q) => (
              <View key={q.id} style={styles.card}>
                <Text style={styles.name}>{q.subject_type}</Text>
                <Text style={styles.meta}>{q.flag_reason || 'Flagged'}</Text>
                <View style={styles.actions}>
                  <TouchableOpacity onPress={() => decideQueue(q.id, 'approved')}><Text style={styles.ok}>Approve</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => decideQueue(q.id, 'rejected')}><Text style={styles.no}>Reject</Text></TouchableOpacity>
                </View>
              </View>
            ))}

            <Text style={styles.sub}>Bug reports</Text>
            {bugs.length === 0 ? <Text style={styles.meta}>No bugs filed.</Text> : null}
            {bugs.map((b) => (
              <View key={b.id} style={styles.card}>
                <Text style={styles.name}>{b.title || 'Untitled'}</Text>
                <Text style={styles.meta}>{b.status} · {b.body}</Text>
              </View>
            ))}

            <Text style={styles.sub}>Settings</Text>
            <TextInput style={styles.input} value={supportEmail} onChangeText={setSupportEmail} placeholder="Support email" autoCapitalize="none" />
            <TextInput style={styles.input} value={maintenance} onChangeText={setMaintenance} placeholder="Maintenance message (empty = off)" />
            <TouchableOpacity style={styles.primary} onPress={async () => {
              const { error } = await supabase.from('app_settings').upsert([
                { key: 'support_email', value: JSON.stringify(supportEmail), updated_by: user.id },
                { key: 'maintenance_message', value: JSON.stringify(maintenance), updated_by: user.id },
              ]);
              if (error) fail(error, 'Could not save settings.');
              else setBanner({ kind: 'success', message: 'Settings saved.' });
            }}><Text style={styles.primaryTxt}>Save settings</Text></TouchableOpacity>
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
