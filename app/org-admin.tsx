// app/org-admin.tsx — Org admin console (scoped to ONE organization)
// Access: organization_members.role = 'admin' for that org (or platform admin).
// Design: prototype "Manage Happy Paws Shelter" screen — teal header + stats, Team, Pending requests.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import SignInPrompt from '@/components/SignInPrompt';

type Member = { user_id: string; role: string; profiles: { full_name: string | null; email: string | null } | null };
type Request = { id: string; scope: string; status: string; requester_id: string; pet_id: string; pets: { name: string } | null; profiles: { full_name: string | null } | null };
const ROLES = ['admin', 'staff', 'volunteer', 'foster_coordinator'];
const roleLabel = (r: string) => ({ admin: 'Admin', staff: 'Staff', volunteer: 'Volunteer', foster_coordinator: 'Foster coordinator' } as any)[r] ?? r;

export default function OrgAdminScreen() {
  const { user, loading: authLoading, actingAs, actingIsOrgAdmin } = useAuth();
  const router = useRouter();
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [petCount, setPetCount] = useState(0);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    if (!actingIsOrgAdmin || actingAs?.role === 'member' || actingAs?.role === 'pet_admin') {
      setOrg(null); setLoading(false); return;
    }
    setLoading(true); setError(null);
    let o: { id: string; name: string } | null = null;
    if (actingAs?.role === 'org_admin' && actingAs.orgId) {
      o = { id: actingAs.orgId, name: actingAs.orgName || 'Organization' };
    } else {
      const { data: mine } = await supabase.from('organization_members')
        .select('organization_id, role, organizations(id, name)').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      if (mine) o = { id: (mine as any).organizations?.id, name: (mine as any).organizations?.name };
    }
    if (!o?.id) { setOrg(null); setLoading(false); return; }
    setOrg(o);
    try {
    const [{ data: m }, { data: r }, { count }] = await Promise.all([
      supabase.from('organization_members').select('user_id, role, profiles(full_name, email)').eq('organization_id', o.id).order('role'),
      supabase.from('record_access_requests').select('id, scope, status, requester_id, pet_id, pets(name), profiles:requester_id(full_name)')
        .eq('status', 'pending').in('pet_id', (await supabase.from('pets').select('id').eq('shelter_id', o.id)).data?.map((p) => p.id) ?? []),
      supabase.from('pets').select('id', { count: 'exact', head: true }).eq('shelter_id', o.id),
    ]);
    setMembers((m as any) ?? []); setRequests((r as any) ?? []); setPetCount(count ?? 0);
    } catch (e: any) {
      setError(e?.message || 'Could not load organization.');
    } finally {
      setLoading(false);
    }
  }, [user, actingAs, actingIsOrgAdmin]);
  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const log = (action: string, extra: object) =>
    supabase.from('audit_log').insert({ actor_id: user!.id, action, organization_id: org!.id, acting_as: actingAs?.role || null, ...extra });

  const cycleRole = async (m: Member) => {
    if (m.user_id === user!.id) return;
    const next = ROLES[(ROLES.indexOf(m.role) + 1) % ROLES.length];
    setBusy(m.user_id);
    const { error: e } = await supabase.from('organization_members').update({ role: next }).eq('organization_id', org!.id).eq('user_id', m.user_id);
    if (e) setError(e.message); else await log('member.role_changed', { subject_type: 'user', subject_id: m.user_id, detail: { to: next } });
    setBusy(null); load();
  };

  const addOrgAdmin = async () => {
    const email = invite.trim().toLowerCase(); if (!email || !org) return;
    setBusy('admin');
    const { data: ppl } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
    if (!ppl) { setError('No user with that email — they must sign up first.'); setBusy(null); return; }
    const { error: e } = await supabase.from('organization_members').upsert({ organization_id: org.id, user_id: ppl.id, role: 'admin' });
    if (e) setError(e.message); else { setInvite(''); await log('member.admin_added', { subject_id: ppl.id }); }
    setBusy(null); load();
  };

  const sendInvite = async () => {
    const email = invite.trim().toLowerCase(); if (!email) return;
    setBusy('invite');
    const { error: e } = await supabase.from('organization_invites').insert({ organization_id: org!.id, email, role: 'staff', invited_by: user!.id });
    if (e) setError(e.message); else { setInvite(''); await log('member.invited', { detail: { email } }); }
    setBusy(null);
  };

  const decide = async (r: Request, decision: 'approved' | 'rejected') => {
    setBusy(r.id);
    const { error: e } = await supabase.from('record_access_requests')
      .update({ status: decision, decided_by: user!.id, decided_at: new Date().toISOString() }).eq('id', r.id);
    if (e) setError(e.message); else await log(`access_request.${decision}`, { subject_type: 'record_access_request', subject_id: r.id });
    setBusy(null); load();
  };

  if (!user) {
    return (
      <Shell>
        {authLoading ? null : (
          <SignInPrompt title="Sign in to manage this organization" message="Team, pets, and requests are only for organization members." />
        )}
      </Shell>
    );
  }

  if (authLoading || loading) return <Shell><ActivityIndicator color={Colors.teal} style={{ marginTop: 40 }} /></Shell>;
  if (!user || !org) return (
    <Shell><View style={s.col}><Text style={s.h}>No organization to manage</Text>
      <Text style={s.body}>You're not the admin of any organization. Platform administrators use Me → Open admin console. Org admins are assigned per organization.</Text>
      <TouchableOpacity onPress={() => router.back()}><Text style={s.link}>Back</Text></TouchableOpacity></View></Shell>
  );

  return (
    <Shell>
        <View style={s.col}>
          <View style={s.hero}>
            <Text style={s.heroTitle}>{org.name}</Text>
            <Text style={s.heroSub}>Org admin · manage your organization only</Text>
            <View style={s.statRow}>
              {[[members.length, 'Members'], [petCount, 'Pets listed'], [requests.length, 'Pending requests']].map(([n, l]) => (
                <View key={String(l)} style={s.stat}><Text style={s.statN}>{n}</Text><Text style={s.statL}>{l}</Text></View>
              ))}
            </View>
          </View>
          {error ? <Text style={s.err}>{error}</Text> : null}

          <Text style={s.section}>Team</Text>
          <View style={s.list}>
            {members.map((m) => (
              <View key={m.user_id} style={s.row}>
                <View style={s.avatar}><Text style={s.avatarTxt}>{(m.profiles?.full_name || m.profiles?.email || '?')[0].toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{m.profiles?.full_name || 'Member'}</Text>
                  <Text style={s.meta}>{m.profiles?.email}</Text>
                </View>
                <TouchableOpacity onPress={() => cycleRole(m)} disabled={busy === m.user_id}
                  style={[s.pill, m.role === 'admin' ? s.pillNavy : m.role === 'staff' ? s.pillTeal : m.role === 'volunteer' ? s.pillYellow : s.pillGray]}>
                  <Text style={[s.pillTxt, m.role === 'admin' && { color: Colors.white }]}>{roleLabel(m.role)} ▾</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={s.inviteRow}>
            <TextInput value={invite} onChangeText={setInvite} placeholder="Invite by email" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="email-address" style={s.input} />
            <TouchableOpacity style={s.inviteBtn} onPress={sendInvite} disabled={busy === 'invite'}><Text style={s.inviteTxt}>Invite</Text></TouchableOpacity>
          </View>
          <TouchableOpacity style={[s.inviteBtn, { alignSelf: 'stretch', marginBottom: 8 }]} onPress={addOrgAdmin} disabled={busy === 'admin'}>
            <Text style={s.inviteTxt}>{busy === 'admin' ? '…' : 'Add org admin'}</Text>
          </TouchableOpacity>

          <Text style={s.section}>Pending requests · your org</Text>
          {requests.length === 0 ? <View style={s.card}><Text style={s.meta}>Nothing pending.</Text></View> : null}
          {requests.map((r) => (
            <View key={r.id} style={s.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[s.name, { flex: 1 }]}>{r.profiles?.full_name || 'Someone'} · {r.pets?.name}</Text>
                <Text style={[s.pill, s.pillGray, s.pillTxt]}>{r.scope.replace('_', ' ').toUpperCase()}</Text>
              </View>
              <Text style={s.meta}>Record access request</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity style={s.ok} onPress={() => decide(r, 'approved')} disabled={busy === r.id}><Text style={s.okTxt}>Approve</Text></TouchableOpacity>
                <TouchableOpacity style={s.no} onPress={() => decide(r, 'rejected')} disabled={busy === r.id}><Text style={s.noTxt}>Decline</Text></TouchableOpacity>
              </View>
            </View>
          ))}

          <View style={s.note}><Text style={s.noteTxt}>You can only see and manage {org.name}. Platform-wide moderation and other organizations are handled by Rescue Army administrators.</Text></View>
        </View>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={s.wrap} edges={['top']}>
      <AppHeader title="Manage organization" showBack />
      <Page>{children}</Page>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  col: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 24, gap: 14 },
  hero: { backgroundColor: Colors.teal, borderRadius: 18, padding: 18 },
  heroTitle: { fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.white },
  heroSub: { fontFamily: Fonts.regular, fontSize: 12, color: '#D3EFEC', marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, paddingVertical: 10 },
  statN: { fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.white },
  statL: { fontFamily: Fonts.semibold, fontSize: 10, color: '#D3EFEC', marginTop: 2 },
  section: { fontFamily: Fonts.extrabold, fontSize: 12, color: Colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 6 },
  list: { backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.navy },
  name: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy },
  meta: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  pillTxt: { fontFamily: Fonts.extrabold, fontSize: 10.5, color: Colors.navy },
  pillNavy: { backgroundColor: Colors.navy }, pillTeal: { backgroundColor: Colors.tealBg }, pillYellow: { backgroundColor: Colors.standardBg }, pillGray: { backgroundColor: Colors.surface },
  inviteRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Fonts.regular, fontSize: 13, color: Colors.text, backgroundColor: Colors.white },
  inviteBtn: { backgroundColor: Colors.navy, borderRadius: 14, paddingHorizontal: 18, justifyContent: 'center' },
  inviteTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 13 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  ok: { flex: 1, backgroundColor: Colors.teal, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  okTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 12 },
  no: { flex: 1, borderWidth: 1.5, borderColor: Colors.critical, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  noTxt: { color: Colors.critical, fontFamily: Fonts.bold, fontSize: 12 },
  note: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12 },
  noteTxt: { fontFamily: Fonts.regular, fontSize: 11.5, color: Colors.textBody, lineHeight: 17 },
  h: { fontFamily: Fonts.extrabold, fontSize: FontSizes.xl, color: Colors.navy },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
  link: { color: Colors.coral, fontFamily: Fonts.bold, marginTop: 12 },
  err: { color: Colors.critical, fontFamily: Fonts.medium, fontSize: FontSizes.sm },
});
