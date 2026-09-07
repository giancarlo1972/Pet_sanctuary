import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, useWindowDimensions, TextInput, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { isPlatformAdmin } from '@/lib/admin-access';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/contact';
import { Page } from '@/components/Page';
import { Card as Surface } from '@/components/Card';

type QueueItem = {
  id: string;
  subject_type: string;
  subject_id: string;
  flag_reason: string | null;
  status: string;
  title?: string;
};

export default function AdminScreen() {
  const { user, loading: authLoading, actingIsPlatform } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [role, setRole] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string; status: string | null; org_type?: string | null }[]>([]);
  const [allOrgs, setAllOrgs] = useState<any[]>([]);
  const [editOrg, setEditOrg] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<{ id: string; email: string | null; full_name: string | null; role: string | null; blocked: boolean | null }[]>([]);
  const [memberQ, setMemberQ] = useState('');
  const [bugs, setBugs] = useState<{ id: string; title: string | null; body: string | null; status: string; created_at: string }[]>([]);
  const [supportEmail, setSupportEmail] = useState('support.animals@rescue-army.com');
  const [maintenance, setMaintenance] = useState('');
  const [uploadUserId, setUploadUserId] = useState('');

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data: profile } = await supabase.from('profiles').select('role, full_name, email').eq('id', user.id).maybeSingle();
    const r = (profile?.role || '').toLowerCase().trim();
    const email = (user.email || profile?.email || '').toLowerCase();
    setRole(r || 'member');
    if (!actingIsPlatform) { setLoading(false); return; }

    const { data: q } = await supabase
      .from('moderation_queue')
      .select('id, subject_type, subject_id, flag_reason, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(40);
    setQueue((q as QueueItem[]) ?? []);

    const { data: orgRows, error: orgErr } = await supabase
      .from('organizations')
      .select('id, name, org_type, status, logo_url')
      .in('status', ['pending', 'submitted', 'review', 'pending_review'])
      .order('name')
      .limit(40);
    if (orgErr) setError(orgErr.message);
    setOrgs(orgRows ?? []);
    const { data: allRows, error: allErr } = await supabase
      .from('organizations')
      .select('id, name, org_type, status, website, contact_email, logo_url')
      .order('name')
      .limit(80);
    if (allErr) setError((orgErr?.message ? orgErr.message + ' · ' : '') + allErr.message);
    setAllOrgs(allRows ?? []);

    const { data: mems } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, blocked')
      .order('email')
      .limit(80);
    if (mems) setMembers(mems as any);
    else {
      const { data: mems2 } = await supabase.from('profiles').select('id, email, full_name, role').order('email').limit(80);
      setMembers(((mems2 || []) as any).map((m: any) => ({ ...m, blocked: false })));
    }
    const { data: bugRows } = await supabase.from('bug_reports').select('id, title, body, status, created_at').order('created_at', { ascending: false }).limit(30);
    setBugs((bugRows as any) ?? []);
    const { data: settings } = await supabase.from('app_settings').select('key, value');
    (settings || []).forEach((s: any) => {
      if (s.key === 'support_email') setSupportEmail(typeof s.value === 'string' ? s.value.replace(/"/g, '') : String(s.value || ''));
      if (s.key === 'maintenance_message') setMaintenance(typeof s.value === 'string' ? s.value.replace(/^"|"$/g, '') : '');
    });
    setLoading(false);
  }, [user, actingIsPlatform]);

  useEffect(() => { if (!authLoading) load(); }, [authLoading, load]);

  const decide = async (item: QueueItem, decision: 'approved' | 'rejected') => {
    setBusyId(item.id);
    setError(null);
    const { error: upErr } = await supabase.from('moderation_queue').update({ status: decision }).eq('id', item.id);
    if (upErr) {
      setError(upErr.message);
      setBusyId(null);
      return;
    }
    if (item.subject_type === 'organization') {
      await supabase.from('organizations').update({ status: decision === 'approved' ? 'approved' : 'rejected' }).eq('id', item.subject_id);
    }
    if (item.subject_type === 'user' && decision === 'approved') {
      await supabase.from('user_verifications').upsert({
        user_id: item.subject_id,
        id_verified: true,
        id_status: 'approved',
      });
    }
    if (item.subject_type === 'report') {
      await supabase.from('reports').update({ status: decision === 'approved' ? 'open' : 'dismissed' }).eq('id', item.subject_id);
    }
    setBusyId(null);
    load();
  };

  const decideOrg = async (id: string, decision: 'approved' | 'rejected') => {
    setBusyId(id);
    await supabase.from('organizations').update({ status: decision }).eq('id', id);
    setBusyId(null);
    load();
  };

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.wrap} edges={['top']}>
        <AppHeader title="Admin" showBack />
        <ActivityIndicator color={Colors.coral} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.wrap} edges={['top']}>
        <AppHeader title="Admin" showBack />
        <Text style={styles.pad}>Sign in as an administrator.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.push('/(tabs)/profile')}>
          <Text style={styles.btnTxt}>Go to Me</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!actingIsPlatform) {
    return (
      <SafeAreaView style={styles.wrap} edges={['top']}>
        <AppHeader title="Admin" showBack />
        <View style={styles.phone}>
          <Text style={styles.h1}>No admin access</Text>
          <Text style={styles.body}>This console is for Rescue Army platform administrators only. Org admins use Me → Manage organization. Your role is {role || 'member'}.</Text>
          <TouchableOpacity onPress={() => Linking.openURL(supportMailto('Admin access request'))}>
            <Text style={styles.link}>Request access · {SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const assignAdmin = async (orgId: string) => {
    if (typeof window === 'undefined') return;
    const email = (window.prompt('Email of the new org admin') || '').trim().toLowerCase();
    if (!email || !user) return;
    setBusyId(orgId); setError(null);
    const { data: ppl } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
    if (!ppl) { setError('No user with that email.'); setBusyId(null); return; }
    await supabase.from('organization_members').update({ role: 'staff' }).eq('organization_id', orgId).eq('role', 'admin');
    const { error: up } = await supabase.from('organization_members').upsert({ organization_id: orgId, user_id: ppl.id, role: 'admin' });
    if (up) setError(up.message);
    else await supabase.from('audit_log').insert({ actor_id: user.id, action: 'org.admin_assigned', organization_id: orgId, subject_id: ppl.id, acting_as: 'platform_admin' });
    setBusyId(null); load();
  };

  const orgsQ = queue.filter((q) => q.subject_type === 'organization');
  const reportsQ = queue.filter((q) => q.subject_type === 'report');
  const usersQ = queue.filter((q) => q.subject_type === 'user' || q.subject_type === 'id');

  const stats = [
    { n: orgs.length + orgsQ.length, label: 'Org reviews', color: '#FBD3D0' },
    { n: reportsQ.length, label: 'Flagged reports', color: '#FCE9C8' },
    { n: usersQ.length, label: 'ID reviews', color: '#BDE8E4' },
  ];
  const maskEin = (ein: string | null) => ein ? `••-••${ein.slice(-5)}` : 'No EIN on file';

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <AppHeader title="Admin" showBack maxWidth={880} />
      <Page wideMax={880}>
        <View style={styles.col}>
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Admin console</Text>
            <Text style={styles.heroSub}>Administrator · full access · all actions logged</Text>
            <View style={styles.statRow}>
              {stats.map((st) => (
                <View key={st.label} style={styles.stat}>
                  <Text style={[styles.statN, { color: st.color }]}>{st.n}</Text>
                  <Text style={styles.statL}>{st.label}</Text>
                </View>
              ))}
            </View>
          </View>
          {error ? <Text style={styles.err}>{error}</Text> : null}

          <Section title="Organizations · All entities">
            {allOrgs.length === 0 ? <EmptyOrgs /> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {allOrgs.map((o) => (
              <View key={o.id} style={{ width: wide ? '48.5%' : '100%' }}>
              <View style={styles.entity}>
                <View style={[styles.entityAv, { backgroundColor: Colors.navy }]}>
                  <Text style={styles.entityAvTxt}>{(o.name || '?').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{o.name}</Text>
                  <Text style={styles.meta}>{(o.org_type || 'Organization')} · {o.status || 'unknown'}</Text>
                </View>
                {['pending','submitted','review','pending_review'].includes((o.status || '').toLowerCase()) ? (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity onPress={() => decideOrg(o.id, 'approved')}><Text style={styles.reassign}>Verify</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => decideOrg(o.id, 'rejected')}><Text style={styles.rejectTxt}>Reject</Text></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => assignAdmin(o.id)}><Text style={styles.reassign}>Assign admin</Text></TouchableOpacity>
                )}
                <TouchableOpacity onPress={async () => {
                  setEditOrg(o); setEditName(o.name || '');
                  const { data: priv } = await supabase.from('organization_private').select('ein').eq('organization_id', o.id).maybeSingle();
                  setEditOrg({ ...o, ein: priv?.ein || null });
                }}><Text style={styles.meta}>⋮</Text></TouchableOpacity>
              </View>
              </View>
            ))}
            </View>
            <Text style={styles.noteTxt}>Each entity gets one Org admin who manages its own members. Platform admins can reassign, suspend, or step in.</Text>
          </Section>
          <Section title="Org verifications">
            {orgs.length === 0 && orgsQ.length === 0 ? <Empty /> : null}
            {orgs.map((o) => (
              <ReviewCard key={o.id} title={o.name} meta={o.org_type || 'Organization'} pill={o.status || 'pending'} pillOk={(o.status || '') === 'approved'}
                busy={busyId === o.id} okLabel="Verify org" onOk={() => decideOrg(o.id, 'approved')} onNo={() => decideOrg(o.id, 'rejected')} />
            ))}
            {orgsQ.map((q) => (
              <ReviewCard key={q.id} title={q.flag_reason || 'Organization'} meta="Flagged by moderation" busy={busyId === q.id} okLabel="Verify org" onOk={() => decide(q, 'approved')} onNo={() => decide(q, 'rejected')} />
            ))}
          </Section>
          <Section title="Report moderation">
            {reportsQ.length === 0 ? <Empty /> : null}
            {reportsQ.map((q) => (
              <ReviewCard key={q.id} title={q.flag_reason || 'Report'} meta="Pending review" busy={busyId === q.id} okLabel="Approve" onOk={() => decide(q, 'approved')} onNo={() => decide(q, 'rejected')} />
            ))}
          </Section>
          <Section title="User verifications">
            {usersQ.length === 0 ? <Empty /> : null}
            {usersQ.map((q) => (
              <ReviewCard key={q.id} title={q.flag_reason || 'ID review'} meta="Responder / volunteer / foster" busy={busyId === q.id} okLabel="Approve" onOk={() => decide(q, 'approved')} onNo={() => decide(q, 'rejected')} />
            ))}
          </Section>

          <Section title="Members">
            <TextInput style={styles.input} value={memberQ} onChangeText={setMemberQ} placeholder="Search email or name" placeholderTextColor={Colors.textTertiary} />
            {members.filter((m) => {
              const q = memberQ.trim().toLowerCase();
              if (!q) return true;
              return `${m.email || ''} ${m.full_name || ''}`.toLowerCase().includes(q);
            }).slice(0, 40).map((m) => (
              <Surface key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{m.full_name || m.email || m.id.slice(0, 8)}</Text>
                  <Text style={styles.meta}>{m.email} · {m.role || 'member'}{m.blocked ? ' · blocked' : ''}</Text>
                </View>
                <TouchableOpacity onPress={async () => {
                  setBusyId(m.id);
                  await supabase.from('profiles').update({ role: m.role === 'platform_admin' ? 'member' : 'platform_admin' }).eq('id', m.id);
                  setBusyId(null); load();
                }}><Text style={styles.reassign}>{m.role === 'platform_admin' ? 'Make member' : 'Make admin'}</Text></TouchableOpacity>
                <TouchableOpacity onPress={async () => {
                  setBusyId(m.id);
                  await supabase.from('profiles').update({ blocked: !m.blocked }).eq('id', m.id);
                  setBusyId(null); load();
                }}><Text style={m.blocked ? styles.reassign : styles.rejectTxt}>{m.blocked ? 'Unblock' : 'Block'}</Text></TouchableOpacity>
              </Surface>
            ))}
            <Text style={styles.noteTxt}>Upload a document for a user (ID, license) — they still confirm it.</Text>
            <TextInput style={styles.input} value={uploadUserId} onChangeText={setUploadUserId} placeholder="User email to upload for" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
            <TouchableOpacity style={styles.ghost} onPress={async () => {
              const email = uploadUserId.trim().toLowerCase();
              if (!email) return;
              const { data: ppl } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
              if (!ppl) { setError('No user with that email.'); return; }
              const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
              if (pick.canceled || !pick.assets?.[0]) return;
              const blob = await (await fetch(pick.assets[0].uri)).blob();
              const path = `${ppl.id}/admin-upload-${Date.now()}.jpg`;
              const { error: up } = await supabase.storage.from('id-docs').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
              if (up) { setError(up.message); return; }
              await supabase.from('user_verifications').upsert({ user_id: ppl.id, id_document_path: path, id_status: 'pending', id_verified: false });
              setError(null);
            }}><Text style={styles.ghostTxt}>Upload for user</Text></TouchableOpacity>
          </Section>

          <Section title="Bug reports">
            {bugs.length === 0 ? <Empty /> : null}
            {bugs.map((b) => (
              <Surface key={b.id}>
                <Text style={styles.cardTitle}>{b.title || 'Untitled'}</Text>
                <Text style={styles.meta}>{b.status} · {b.body}</Text>
                <View style={styles.row}>
                  {['open', 'in_progress', 'resolved', 'wontfix'].map((st) => (
                    <TouchableOpacity key={st} style={styles.ghost} onPress={async () => {
                      await supabase.from('bug_reports').update({ status: st }).eq('id', b.id);
                      load();
                    }}><Text style={styles.ghostTxt}>{st}</Text></TouchableOpacity>
                  ))}
                </View>
              </Surface>
            ))}
          </Section>

          <Section title="App settings">
            <Text style={styles.meta}>Support email</Text>
            <TextInput style={styles.input} value={supportEmail} onChangeText={setSupportEmail} autoCapitalize="none" />
            <Text style={styles.meta}>Maintenance message (empty = off)</Text>
            <TextInput style={styles.input} value={maintenance} onChangeText={setMaintenance} />
            <TouchableOpacity style={styles.verify} onPress={async () => {
              await supabase.from('app_settings').upsert([
                { key: 'support_email', value: JSON.stringify(supportEmail), updated_by: user?.id },
                { key: 'maintenance_message', value: JSON.stringify(maintenance), updated_by: user?.id },
              ]);
            }}><Text style={styles.verifyTxt}>Save settings</Text></TouchableOpacity>
          </Section>

          <View style={styles.note}>
            <Text style={styles.noteTxt}>Every admin action is written to the audit log with your user ID and timestamp. Access to PII/medical records requires an approved access request even for admins.</Text>
          </View>
        </View>

      {editOrg ? (
        <View style={styles.sheetScrim}>
          <View style={styles.sheet}>
            <Text style={styles.heroTitle}>Edit organization</Text>
            <Text style={styles.meta}>Status: {editOrg.status || 'unknown'}</Text>
            <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Name" />
            <View style={styles.row}>
              {['approved','rejected','suspended','pending_review'].map((st) => (
                <TouchableOpacity key={st} style={styles.ghost} onPress={async () => {
                  await supabase.from('organizations').update({ status: st, name: editName.trim() || editOrg.name }).eq('id', editOrg.id);
                  setEditOrg(null); load();
                }}>
                  <Text style={styles.ghostTxt}>{st === 'approved' ? 'Approve' : st === 'rejected' ? 'Reject' : st === 'suspended' ? 'Suspend' : 'Pending'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.ghost} onPress={() => assignAdmin(editOrg.id)}>
              <Text style={styles.ghostTxt}>Assign admin</Text>
            </TouchableOpacity>
            {editOrg.logo_url ? (
              <TouchableOpacity style={styles.ghost} onPress={async () => {
                await supabase.from('organizations').update({ logo_url: null }).eq('id', editOrg.id);
                setEditOrg(null); load();
              }}><Text style={styles.ghostTxt}>Remove image</Text></TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.reject} onPress={async () => {
              if (typeof window !== 'undefined' && !window.confirm('Delete this organization? This cannot be undone.')) return;
              await supabase.from('organizations').delete().eq('id', editOrg.id);
              setEditOrg(null); load();
            }}><Text style={styles.rejectTxt}>Delete</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setEditOrg(null)}><Text style={styles.link}>Close</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}
      </Page>
    </SafeAreaView>
  );
}

function Empty() {
  return <View style={styles.empty}><Text style={styles.muted}>Queue clear — nothing pending.</Text></View>;
}
function EmptyOrgs() {
  return <View style={styles.empty}><Text style={styles.muted}>No organizations yet</Text></View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.section}>{title}</Text>
      {children}
    </View>
  );
}

function ReviewCard({
  title, meta, pill, pillOk, busy, okLabel, onOk, onNo,
}: {
  title: string; meta: string; pill?: string; pillOk?: boolean; busy: boolean; okLabel: string;
  onOk: () => void; onNo: () => void;
}) {
  return (
    <Surface>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
        {pill ? <Text style={[styles.pill, pillOk ? styles.pillOk : styles.pillNo]}>{pill}</Text> : null}
      </View>
      <Text style={styles.meta}>{meta}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.verify} onPress={onOk} disabled={busy}><Text style={styles.verifyTxt}>{busy ? '…' : okLabel}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.reject} onPress={onNo} disabled={busy}><Text style={styles.rejectTxt}>Reject</Text></TouchableOpacity>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  entity: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border },
  entityAv: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  entityAvTxt: { color: Colors.white, fontFamily: Fonts.bold },
  reassign: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.navy },
  scroll: { paddingBottom: 48 },
  col: { width: '100%', maxWidth: 880, alignSelf: 'center', padding: 16, gap: 18 },
  hero: { backgroundColor: Colors.navy, borderRadius: 18, padding: 18 },
  heroTitle: { fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.white },
  heroSub: { fontFamily: Fonts.regular, fontSize: 12, color: '#B9BCE0', marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 10 },
  statN: { fontFamily: Fonts.extrabold, fontSize: 18 },
  statL: { fontFamily: Fonts.semibold, fontSize: 10, color: '#B9BCE0', marginTop: 2 },
  section: { fontFamily: Fonts.extrabold, fontSize: 12, color: Colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy },
  pill: { fontFamily: Fonts.bold, fontSize: 10.5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  pillOk: { backgroundColor: Colors.tealBg, color: Colors.tealDark },
  pillNo: { backgroundColor: Colors.criticalBg, color: Colors.critical },
  empty: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  muted: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textTertiary },
  meta: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  verify: { flex: 1, backgroundColor: Colors.teal, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  verifyTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 12 },
  reject: { flex: 1, borderWidth: 1.5, borderColor: Colors.critical, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  rejectTxt: { color: Colors.critical, fontFamily: Fonts.bold, fontSize: 12 },
  note: { flexDirection: 'row', gap: 10, backgroundColor: Colors.surface, borderRadius: 12, padding: 12 },
  noteTxt: { flex: 1, fontFamily: Fonts.regular, fontSize: 11.5, color: '#4A4E69', lineHeight: 17 },
  links: { flexDirection: 'row', gap: 10 },
  ghost: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ghostTxt: { fontFamily: Fonts.bold, color: Colors.navy },
  pad: { padding: 16, fontFamily: Fonts.regular, color: Colors.textSecondary },
  err: { color: Colors.critical, fontFamily: Fonts.medium, fontSize: FontSizes.sm },
  link: { color: Colors.coral, fontFamily: Fonts.bold, marginTop: 12 },
  btn: { margin: 16, backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnTxt: { color: Colors.white, fontFamily: Fonts.bold },
  h1: { fontFamily: Fonts.extrabold, fontSize: FontSizes.xl, color: Colors.navy },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
  phone: { flex: 1, width: '100%' },
  sheetScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontFamily: Fonts.regular, color: Colors.text },
});
