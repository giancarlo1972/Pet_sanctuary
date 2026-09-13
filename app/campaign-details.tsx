import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Share, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { ShieldCheck, Megaphone } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { InlineBanner } from '@/components/InlineBanner';
import SignedImage from '@/components/SignedImage';
import {
  CAMPAIGN_SELECT, campaignType, campaignTypeLabel, firstName, formatCount, progressPct, isRemoteUrl,
  type Campaign, type PetitionSignature,
} from '@/lib/campaigns';
import { orgVerifyBadge } from '@/lib/org-type';

const INTER = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.regular;
const INTERB = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.bold;
const INTEREB = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.extrabold;

function unwrapOrg(raw: any) {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

export default function CampaignDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, actingIsPlatform, orgs } = useAuth();
  const [camp, setCamp] = useState<Campaign | null>(null);
  const [sigs, setSigs] = useState<PetitionSignature[]>([]);
  const [updates, setUpdates] = useState<{ id: string; title?: string | null; body: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [signed, setSigned] = useState(false);
  const [comment, setComment] = useState('');
  const [anonName, setAnonName] = useState('');
  const [anonEmail, setAnonEmail] = useState('');
  const [anonCity, setAnonCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [updateBody, setUpdateBody] = useState('');
  const [mgrExtra, setMgrExtra] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    let { data, error } = await supabase.from('campaigns').select(CAMPAIGN_SELECT).eq('id', id).maybeSingle();
    if (error || !data) {
      const retry = await supabase.from('campaigns').select('id, title, kind, status, org_id, manager_id, body, goal_amount, raised_amount').eq('id', id).maybeSingle();
      data = retry.data as typeof data;
      error = retry.error;
    }
    if (error || !data) {
      setCamp(null);
      setLoading(false);
      return;
    }
    const row: any = data;
    setCamp({ ...row, org: unwrapOrg(row.organizations) });
    const [{ data: s }, { data: u }] = await Promise.all([
      supabase.from('petition_signatures').select('id, name, city, comment, created_at').eq('campaign_id', id).eq('verified', true).eq('public', true).order('created_at', { ascending: false }).limit(40),
      supabase.from('campaign_updates').select('id, title, body, created_at').eq('campaign_id', id).order('created_at', { ascending: false }).limit(20),
    ]);
    setSigs((s as any) || []);
    setUpdates((u as any) || []);
    if (user) {
      const [{ data: mine }, { data: cm }] = await Promise.all([
        supabase.from('petition_signatures').select('id').eq('campaign_id', id).eq('user_id', user.id).eq('verified', true).maybeSingle(),
        supabase.from('campaign_managers').select('user_id').eq('campaign_id', id).eq('user_id', user.id).maybeSingle(),
      ]);
      setSigned(Boolean(mine));
      setMgrExtra(Boolean(cm));
    } else { setSigned(false); setMgrExtra(false); }
    setLoading(false);
  }, [id, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const org = camp?.org;
  const badge = org ? orgVerifyBadge(org) : null;
  const isPetition = camp ? campaignType(camp) === 'petition' : false;
  const count = camp?.signature_count || 0;
  const goal = camp?.goal_count || 0;
  const pct = progressPct(count, goal);
  const isManager = Boolean(user && camp && (
    camp.manager_id === user.id
    || actingIsPlatform
    || mgrExtra
    || (camp.org_id && orgs.some((o) => o.id === camp.org_id))
  ));

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `https://hub-preview.pet-sanctuary.pages.dev/campaign-details?id=${id}`;
    return window.location.href;
  }, [id]);

  const copyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) await navigator.clipboard.writeText(shareUrl);
      else await Share.share({ message: shareUrl });
      setBanner({ kind: 'success', message: 'Link copied.' });
    } catch {
      setBanner({ kind: 'info', message: shareUrl });
    }
  };

  const openShare = (kind: string) => {
    const text = encodeURIComponent(`${camp?.title || 'Petition'} — ${shareUrl}`);
    const map: Record<string, string> = {
      x: `https://twitter.com/intent/tweet?text=${text}`,
      instagram: shareUrl,
      tiktok: shareUrl,
      dodo: 'https://www.thedodo.com/',
    };
    if (kind === 'instagram' || kind === 'tiktok') {
      copyLink();
      setBanner({ kind: 'success', message: 'Link copied — paste it in ' + (kind === 'instagram' ? 'Instagram' : 'TikTok') + '.' });
      return;
    }
    if (typeof window !== 'undefined') window.open(map[kind] || shareUrl, '_blank', 'noopener');
  };

  const signIn = async () => {
    if (!id) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('sign_petition', {
      cid: id,
      p_comment: comment.trim() || null,
      p_public: true,
    });
    setBusy(false);
    if (error) { setBanner({ kind: 'error', message: error.message || 'Could not sign.' }); return; }
    setSigned(true);
    const n = (data as any)?.count;
    if (typeof n === 'number') setCamp((c) => c ? { ...c, signature_count: n } : c);
    setBanner({ kind: 'success', message: 'Signed. Thank you.' });
    load();
  };

  const signAnon = async () => {
    if (!id) return;
    if (anonName.trim().length < 2 || !anonEmail.includes('@')) {
      setBanner({ kind: 'error', message: 'Name and email are required.' });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('request_petition_sign', {
      cid: id,
      p_name: anonName.trim(),
      p_email: anonEmail.trim(),
      p_city: anonCity.trim() || null,
      p_comment: comment.trim() || null,
      p_public: true,
    });
    setBusy(false);
    if (error) { setBanner({ kind: 'error', message: error.message || 'Could not submit.' }); return; }
    setBanner({ kind: 'success', message: 'Check your email for a confirmation link. Your signature counts once you verify.' });
  };

  const postUpdate = async () => {
    if (!id || !updateBody.trim()) return;
    const { error } = await supabase.from('campaign_updates').insert({
      campaign_id: id, author_id: user?.id || null, body: updateBody.trim(),
    });
    if (error) { setBanner({ kind: 'error', message: error.message }); return; }
    setUpdateBody('');
    load();
  };

  const exportCsv = async () => {
    if (!id) return;
    setExporting(true);
    const { data, error } = await supabase
      .from('petition_signatures')
      .select('name, email, city, comment, verified, created_at')
      .eq('campaign_id', id)
      .eq('verified', true)
      .order('created_at', { ascending: true });
    setExporting(false);
    if (error) { setBanner({ kind: 'error', message: error.message }); return; }
    const rows = (data || []) as any[];
    const header = 'name,email,city,comment,signed_at';
    const body = rows.map((r) => [r.name, r.email, r.city || '', (r.comment || '').replace(/"/g, '""'), r.created_at]
      .map((v) => `"${v}"`).join(',')).join('\n');
    const csv = `${header}\n${body}`;
    if (typeof window !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(camp?.title || 'petition').replace(/\s+/g, '-').slice(0, 40)}-signatures.csv`;
      a.click();
    }
    setBanner({ kind: 'success', message: `${rows.length} signatures exported.` });
  };

  const exportPdf = async () => {
    if (!id) return;
    setExporting(true);
    const { data } = await supabase
      .from('petition_signatures')
      .select('name, email, city, created_at')
      .eq('campaign_id', id)
      .eq('verified', true)
      .order('created_at', { ascending: true });
    setExporting(false);
    const rows = (data || []) as any[];
    const html = `<html><body style="font-family:Inter,sans-serif;padding:24px">
      <h1>${camp?.title || 'Petition'}</h1>
      <p>Target: ${camp?.target || ''}</p>
      <p>${formatCount(count)} verified signatures</p>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
        <tr><th>Name</th><th>Email</th><th>City</th><th>Date</th></tr>
        ${rows.map((r) => `<tr><td>${r.name}</td><td>${r.email}</td><td>${r.city || ''}</td><td>${String(r.created_at).slice(0, 10)}</td></tr>`).join('')}
      </table>
    </body></html>`;
    try {
      const Print = await import('expo-print');
      await Print.printAsync({ html });
    } catch {
      if (typeof window !== 'undefined') {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.wrap} edges={['top']}>
        <AppHeader title="Campaign" showBack />
        <View style={s.center}><ActivityIndicator color={Colors.coral} /></View>
      </SafeAreaView>
    );
  }
  if (!camp) {
    return (
      <SafeAreaView style={s.wrap} edges={['top']}>
        <AppHeader title="Campaign" showBack />
        <Page><Text style={s.empty}>Campaign not found.</Text></Page>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.wrap} edges={['top']}>
      <AppHeader title={campaignTypeLabel(camp)} showBack />
      <Page>
        {banner ? <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} /> : null}
        <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          {camp.cover_url ? (
            isRemoteUrl(camp.cover_url)
              ? <Image source={{ uri: camp.cover_url }} style={s.cover} />
              : <SignedImage path={camp.cover_url} style={s.cover} />
          ) : (
            <View style={s.coverFallback}><Megaphone color={Colors.white} size={36} /></View>
          )}
          <Text style={s.kicker}>{campaignTypeLabel(camp).toUpperCase()}</Text>
          <Text style={s.title}>{camp.title}</Text>
          {org?.name ? (
            <TouchableOpacity
              style={s.orgRow}
              onPress={() => org.id && router.push(`/organization-details?id=${org.id}`)}
              activeOpacity={0.85}
            >
              <Text style={s.orgName}>{org.name}</Text>
              {badge?.teal ? <ShieldCheck color={Colors.teal} size={14} /> : null}
            </TouchableOpacity>
          ) : null}
          {camp.target ? <Text style={s.target}>Delivered to {camp.target}</Text> : null}

          {isPetition ? (
            <View style={s.progressWrap}>
              <View style={s.progressTrack}><View style={[s.progressFill, { width: `${pct}%` as any }]} /></View>
              <Text style={s.progressTxt}>{formatCount(count)} of {formatCount(goal || 0)}</Text>
            </View>
          ) : null}

          {(camp.tags || []).length ? (
            <View style={s.tags}>
              {(camp.tags || []).map((t) => (
                <View key={t} style={s.tag}><Text style={s.tagTxt}>#{t.replace(/^#/, '')}</Text></View>
              ))}
            </View>
          ) : null}

          {camp.body_md || camp.body ? (
            <Text style={s.body}>{camp.body_md || camp.body}</Text>
          ) : null}
          {camp.why_it_matters ? (
            <>
              <Text style={s.section}>Why it matters</Text>
              <Text style={s.body}>{camp.why_it_matters}</Text>
            </>
          ) : null}

          {isPetition && !signed ? (
            <View style={s.signBox}>
              <TextInput
                style={s.input}
                value={comment}
                onChangeText={setComment}
                placeholder="Optional comment"
                placeholderTextColor={Colors.textTertiary}
              />
              {user ? (
                <TouchableOpacity style={s.signBtn} onPress={signIn} disabled={busy} activeOpacity={0.85}>
                  {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={s.signTxt}>Sign</Text>}
                </TouchableOpacity>
              ) : (
                <>
                  <TextInput style={s.input} value={anonName} onChangeText={setAnonName} placeholder="Your name" placeholderTextColor={Colors.textTertiary} />
                  <TextInput style={s.input} value={anonEmail} onChangeText={setAnonEmail} placeholder="Email" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" />
                  <TextInput style={s.input} value={anonCity} onChangeText={setAnonCity} placeholder="City (optional)" placeholderTextColor={Colors.textTertiary} />
                  <TouchableOpacity style={s.signBtn} onPress={signAnon} disabled={busy} activeOpacity={0.85}>
                    {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={s.signTxt}>Sign with email</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/auth')} activeOpacity={0.8}>
                    <Text style={s.link}>Already a member? Sign in for one-tap</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : isPetition && signed ? (
            <View style={s.signedPill}><Text style={s.signedTxt}>Signed ✓</Text></View>
          ) : null}

          <Text style={s.section}>Share</Text>
          <View style={s.shareRow}>
            {[
              { k: 'instagram', l: 'Instagram' },
              { k: 'tiktok', l: 'TikTok' },
              { k: 'x', l: 'X' },
              { k: 'copy', l: 'Copy link' },
              { k: 'dodo', l: 'The Dodo' },
            ].map((b) => (
              <TouchableOpacity
                key={b.k}
                style={s.shareBtn}
                onPress={() => (b.k === 'copy' ? copyLink() : openShare(b.k))}
                activeOpacity={0.85}
              >
                <Text style={s.shareTxt}>{b.l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {updates.length ? (
            <>
              <Text style={s.section}>Updates</Text>
              {updates.map((u) => (
                <View key={u.id} style={s.update}>
                  {u.title ? <Text style={s.updateTitle}>{u.title}</Text> : null}
                  <Text style={s.updateBody}>{u.body}</Text>
                  <Text style={s.updateMeta}>{String(u.created_at).slice(0, 10)}</Text>
                </View>
              ))}
            </>
          ) : null}

          {isManager ? (
            <View style={s.mgr}>
              <Text style={s.section}>Campaign manager</Text>
              <TextInput
                style={[s.input, { minHeight: 72 }]}
                value={updateBody}
                onChangeText={setUpdateBody}
                placeholder="Post an update"
                placeholderTextColor={Colors.textTertiary}
                multiline
              />
              <TouchableOpacity style={s.secondary} onPress={postUpdate} activeOpacity={0.85}>
                <Text style={s.secondaryTxt}>Post update</Text>
              </TouchableOpacity>
              <View style={s.exportRow}>
                <TouchableOpacity style={s.secondary} onPress={exportCsv} disabled={exporting} activeOpacity={0.85}>
                  <Text style={s.secondaryTxt}>Export CSV</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondary} onPress={exportPdf} disabled={exporting} activeOpacity={0.85}>
                  <Text style={s.secondaryTxt}>Export PDF</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => router.push(`/campaign-new?id=${camp.id}`)} activeOpacity={0.8}>
                <Text style={s.link}>Edit petition</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {isPetition ? (
            <>
              <Text style={s.section}>Signatures</Text>
              {sigs.length === 0 ? <Text style={s.empty}>No public signatures yet.</Text> : sigs.map((sg) => (
                <View key={sg.id} style={s.sigRow}>
                  <Text style={s.sigName}>{firstName(sg.name)}</Text>
                  <Text style={s.sigCity}>{sg.city || ''}</Text>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      </Page>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cover: { width: '100%', height: 180, borderRadius: 16, backgroundColor: Colors.navy, marginBottom: 14 },
  coverFallback: {
    width: '100%', height: 140, borderRadius: 16, backgroundColor: Colors.navy,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  kicker: { fontFamily: INTEREB, fontWeight: '800', fontSize: 11, letterSpacing: 0.8, color: Colors.coral, marginBottom: 6 },
  title: { fontFamily: INTEREB, fontWeight: '800', fontSize: 24, color: Colors.navy, lineHeight: 30 },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  orgName: { fontFamily: INTERB, fontWeight: '700', fontSize: 14, color: Colors.navy },
  target: { fontFamily: INTER, fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  progressWrap: { marginTop: 16, marginBottom: 8 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: Colors.surface, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: Colors.coral },
  progressTxt: { fontFamily: INTERB, fontWeight: '700', fontSize: 13, color: Colors.navy, marginTop: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { backgroundColor: Colors.coralBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagTxt: { fontFamily: INTERB, fontWeight: '700', fontSize: 11, color: Colors.coralDark },
  body: { fontFamily: INTER, fontSize: 15, color: Colors.textBody, lineHeight: 22, marginTop: 12 },
  section: { fontFamily: INTEREB, fontWeight: '800', fontSize: 13, letterSpacing: 0.4, color: Colors.navy, marginTop: 22, marginBottom: 10 },
  signBox: { marginTop: 18, gap: 8 },
  input: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: INTER, color: Colors.navy, backgroundColor: Colors.white,
  },
  signBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  signTxt: { fontFamily: INTERB, fontWeight: '700', fontSize: 16, color: Colors.white },
  signedPill: { alignSelf: 'flex-start', backgroundColor: Colors.tealBg, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 16 },
  signedTxt: { fontFamily: INTERB, fontWeight: '700', fontSize: 14, color: Colors.tealDark },
  shareRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shareBtn: { borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.white },
  shareTxt: { fontFamily: INTERB, fontWeight: '700', fontSize: 12, color: Colors.navy },
  update: { backgroundColor: Colors.white, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  updateTitle: { fontFamily: INTERB, fontWeight: '700', fontSize: 14, color: Colors.navy, marginBottom: 4 },
  updateBody: { fontFamily: INTER, fontSize: 13, color: Colors.textBody, lineHeight: 19 },
  updateMeta: { fontFamily: INTER, fontSize: 11, color: Colors.textTertiary, marginTop: 6 },
  sigRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sigName: { fontFamily: INTERB, fontWeight: '700', fontSize: 14, color: Colors.navy },
  sigCity: { fontFamily: INTER, fontSize: 13, color: Colors.textSecondary },
  mgr: { marginTop: 8, gap: 8 },
  secondary: { borderWidth: 1, borderColor: Colors.navy, borderRadius: 12, paddingVertical: 12, alignItems: 'center', flex: 1 },
  secondaryTxt: { fontFamily: INTERB, fontWeight: '700', fontSize: 13, color: Colors.navy },
  exportRow: { flexDirection: 'row', gap: 8 },
  link: { fontFamily: INTERB, fontWeight: '700', fontSize: 13, color: Colors.coral, marginTop: 6 },
  empty: { fontFamily: INTER, fontSize: 14, color: Colors.textSecondary, marginTop: 8 },
});
