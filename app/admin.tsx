import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { isPlatformAdmin } from '@/lib/admin-access';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/contact';

type QueueItem = {
  id: string;
  subject_type: string;
  subject_id: string;
  flag_reason: string | null;
  status: string;
  title?: string;
};

export default function AdminScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string; status: string | null; ein: string | null }[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data: profile } = await supabase.from('profiles').select('role, full_name, email').eq('id', user.id).maybeSingle();
    const r = (profile?.role || '').toLowerCase().trim();
    const email = (user.email || profile?.email || '').toLowerCase();
    setRole(r || 'member');
    if (!isPlatformAdmin(r, email)) { setLoading(false); return; }

    const { data: q } = await supabase
      .from('moderation_queue')
      .select('id, subject_type, subject_id, flag_reason, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(40);
    setQueue((q as QueueItem[]) ?? []);

    const { data: orgRows } = await supabase
      .from('organizations')
      .select('id, name, status, ein')
      .in('status', ['pending', 'submitted', 'review'])
      .order('name')
      .limit(40);
    setOrgs(orgRows ?? []);
    setLoading(false);
  }, [user]);

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

  if (!isPlatformAdmin(role, user?.email)) {
    return (
      <SafeAreaView style={styles.wrap} edges={['top']}>
        <AppHeader title="Admin" showBack />
        <View style={styles.phone}>
          <Text style={styles.h1}>No admin access</Text>
          <Text style={styles.body}>This console is for Rescue Army administrators and org staff. Your role is {role || 'member'}.</Text>
          <TouchableOpacity onPress={() => Linking.openURL(supportMailto('Admin access request'))}>
            <Text style={styles.link}>Request access · {SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
      <AppHeader title="Admin" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
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

          <Section title="Org verifications">
            {orgs.length === 0 && orgsQ.length === 0 ? <Empty /> : null}
            {orgs.map((o) => (
              <Card key={o.id} title={o.name} meta={maskEin(o.ein)} pill={o.ein ? 'EIN on file' : 'Missing EIN'} pillOk={Boolean(o.ein)}
                busy={busyId === o.id} okLabel="Verify org" onOk={() => decideOrg(o.id, 'approved')} onNo={() => decideOrg(o.id, 'rejected')} />
            ))}
            {orgsQ.map((q) => (
              <Card key={q.id} title={q.flag_reason || 'Organization'} meta="Flagged by moderation" busy={busyId === q.id} okLabel="Verify org" onOk={() => decide(q, 'approved')} onNo={() => decide(q, 'rejected')} />
            ))}
          </Section>
          <Section title="Report moderation">
            {reportsQ.length === 0 ? <Empty /> : null}
            {reportsQ.map((q) => (
              <Card key={q.id} title={q.flag_reason || 'Report'} meta="Pending review" busy={busyId === q.id} okLabel="Approve" onOk={() => decide(q, 'approved')} onNo={() => decide(q, 'rejected')} />
            ))}
          </Section>
          <Section title="User verifications">
            {usersQ.length === 0 ? <Empty /> : null}
            {usersQ.map((q) => (
              <Card key={q.id} title={q.flag_reason || 'ID review'} meta="Responder / volunteer / foster" busy={busyId === q.id} okLabel="Approve" onOk={() => decide(q, 'approved')} onNo={() => decide(q, 'rejected')} />
            ))}
          </Section>

          <View style={styles.note}>
            <Text style={styles.noteTxt}>Every admin action is written to the audit log with your user ID and timestamp. Access to PII/medical records requires an approved access request even for admins.</Text>
          </View>
          <View style={styles.links}>
            <TouchableOpacity style={styles.ghost} onPress={() => router.push('/invoices')}><Text style={styles.ghostTxt}>Invoices by role</Text></TouchableOpacity>
            <TouchableOpacity style={styles.ghost} onPress={() => router.push('/pet-care')}><Text style={styles.ghostTxt}>Gina care record</Text></TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Empty() {
  return <View style={styles.empty}><Text style={styles.muted}>Queue clear — nothing pending.</Text></View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.section}>{title}</Text>
      {children}
    </View>
  );
}

function Card({
  title, meta, pill, pillOk, busy, okLabel, onOk, onNo,
}: {
  title: string; meta: string; pill?: string; pillOk?: boolean; busy: boolean; okLabel: string;
  onOk: () => void; onNo: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
        {pill ? <Text style={[styles.pill, pillOk ? styles.pillOk : styles.pillNo]}>{pill}</Text> : null}
      </View>
      <Text style={styles.meta}>{meta}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.verify} onPress={onOk} disabled={busy}><Text style={styles.verifyTxt}>{busy ? '…' : okLabel}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.reject} onPress={onNo} disabled={busy}><Text style={styles.rejectTxt}>Reject</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  scroll: { paddingBottom: 48 },
  col: { width: '100%', maxWidth: 560, alignSelf: 'center', padding: 16, gap: 18 },
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
});
