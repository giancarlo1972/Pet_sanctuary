import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/contact';

type QueueItem = {
  id: string;
  subject_type: string;
  subject_id: string;
  flag_reason: string | null;
  status: string;
  title?: string;
};

const ADMIN_ROLES = new Set(['admin', 'administrator', 'org_admin', 'shelter']);

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
    const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
    const r = (profile?.role || '').toLowerCase().trim();
    setRole(r || 'member');
    if (!ADMIN_ROLES.has(r)) { setLoading(false); return; }

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

  if (!role || !ADMIN_ROLES.has(role)) {
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

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <AppHeader title="Admin" showBack />
      <View style={styles.phone}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.kicker}>FULL ACCESS · {role.toUpperCase()}</Text>
          <Text style={styles.h1}>Admin console</Text>
          <Text style={styles.body}>Org verifications, reports, and ID review. Actions write to Supabase. PII stays in approved requests only.</Text>
          {error ? <Text style={styles.err}>{error}</Text> : null}

          <TouchableOpacity style={styles.ghost} onPress={() => router.push('/invoices')}>
            <Text style={styles.ghostTxt}>Invoices by role</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghost} onPress={() => router.push('/pet-care')}>
            <Text style={styles.ghostTxt}>Gina care record</Text>
          </TouchableOpacity>

          <Section title="Pending organizations">
            {orgs.length === 0 && orgsQ.length === 0 ? <Text style={styles.muted}>Queue clear.</Text> : null}
            {orgs.map((o) => (
              <Card key={o.id} title={o.name} meta={o.ein ? `EIN ${o.ein}` : 'No EIN on file'} ok={Boolean(o.ein)} busy={busyId === o.id} onOk={() => decideOrg(o.id, 'approved')} onNo={() => decideOrg(o.id, 'rejected')} />
            ))}
            {orgsQ.map((q) => (
              <Card key={q.id} title={q.flag_reason || 'Organization'} meta={q.subject_id} busy={busyId === q.id} onOk={() => decide(q, 'approved')} onNo={() => decide(q, 'rejected')} />
            ))}
          </Section>

          <Section title="Report moderation">
            {reportsQ.length === 0 ? <Text style={styles.muted}>Queue clear.</Text> : null}
            {reportsQ.map((q) => (
              <Card key={q.id} title={q.flag_reason || 'Report'} meta={q.subject_type} busy={busyId === q.id} onOk={() => decide(q, 'approved')} onNo={() => decide(q, 'rejected')} />
            ))}
          </Section>

          <Section title="User / ID verifications">
            {usersQ.length === 0 ? <Text style={styles.muted}>Queue clear.</Text> : null}
            {usersQ.map((q) => (
              <Card key={q.id} title={q.flag_reason || 'ID review'} meta="Pending ID" busy={busyId === q.id} onOk={() => decide(q, 'approved')} onNo={() => decide(q, 'rejected')} />
            ))}
          </Section>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 8, gap: 8 }}>
      <Text style={styles.section}>{title}</Text>
      {children}
    </View>
  );
}

function Card({
  title, meta, ok, busy, onOk, onNo,
}: {
  title: string; meta: string; ok?: boolean; busy: boolean;
  onOk: () => void; onNo: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={[styles.meta, ok ? styles.ok : undefined]}>{meta}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.verify} onPress={onOk} disabled={busy}>
          <Text style={styles.verifyTxt}>{busy ? '\u2026' : 'Verify'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.reject} onPress={onNo} disabled={busy}>
          <Text style={styles.rejectTxt}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  phone: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center' },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  pad: { padding: 16, fontFamily: Fonts.regular, color: Colors.textSecondary },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 10, color: Colors.coral, letterSpacing: 0.8 },
  h1: { fontFamily: Fonts.extrabold, fontSize: FontSizes.xl, color: Colors.navy },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
  section: { fontFamily: Fonts.extrabold, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase' },
  muted: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textTertiary },
  err: { color: Colors.critical, fontFamily: Fonts.medium, fontSize: FontSizes.sm },
  link: { color: Colors.coral, fontFamily: Fonts.bold, marginTop: 12 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  cardTitle: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.navy },
  meta: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, marginTop: 4 },
  ok: { color: Colors.tealDark, fontFamily: Fonts.bold },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  verify: { flex: 1, backgroundColor: Colors.teal, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  verifyTxt: { color: Colors.white, fontFamily: Fonts.bold },
  reject: { flex: 1, borderWidth: 1, borderColor: Colors.critical, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  rejectTxt: { color: Colors.critical, fontFamily: Fonts.bold },
  btn: { margin: 16, backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnTxt: { color: Colors.white, fontFamily: Fonts.bold },
  ghost: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  ghostTxt: { fontFamily: Fonts.bold, color: Colors.navy },
});
