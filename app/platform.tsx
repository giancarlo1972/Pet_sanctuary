import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator,
  Platform as RNPlatform, Modal, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  PawPrint, TriangleAlert, TrendingUp, Users, Building2, LifeBuoy, Search, X,
} from 'lucide-react-native';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { InlineBanner } from '@/components/InlineBanner';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { logAudit } from '@/lib/audit';
import { actingLabel } from '@/lib/acting-as';

const INTER = RNPlatform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.regular;
const INTERB = RNPlatform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.bold;

type Section = 'home' | 'pets' | 'reports' | 'trends' | 'members' | 'orgs' | 'issues';
const SECTIONS: { key: Section; label: string; sub: string; Icon: typeof PawPrint; tint: string; bg: string }[] = [
  { key: 'pets', label: 'Pets', sub: 'Edit · reassign · hide', Icon: PawPrint, tint: Colors.navy, bg: '#EEF0F8' },
  { key: 'reports', label: 'Reports', sub: 'Severity · responders', Icon: TriangleAlert, tint: Colors.coral, bg: Colors.coralBg },
  { key: 'trends', label: 'Trends', sub: 'Needs · helpers · requests', Icon: TrendingUp, tint: Colors.tealDark, bg: Colors.tealBg },
  { key: 'members', label: 'Members', sub: 'Roles · verify · block', Icon: Users, tint: Colors.navy, bg: '#EEF0F8' },
  { key: 'orgs', label: 'Organizations', sub: 'EIN · admins · sync', Icon: Building2, tint: Colors.tealDark, bg: Colors.tealBg },
  { key: 'issues', label: 'Member issues', sub: 'Bugs · tickets · flags', Icon: LifeBuoy, tint: Colors.accentDark, bg: Colors.standardBg },
];

function Pill({ label, ok, warn }: { label: string; ok?: boolean; warn?: boolean }) {
  const bg = ok ? Colors.tealBg : warn ? Colors.standardBg : Colors.surface;
  const color = ok ? Colors.tealDark : warn ? Colors.accentDark : Colors.textSecondary;
  return <Text style={[styles.pill, { backgroundColor: bg, color }]}>{label}</Text>;
}

export default function PlatformScreen() {
  const { user, loading: authLoading, actingIsPlatform, actingAs } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const start = (SECTIONS.some((s) => s.key === params.section) ? params.section : 'home') as Section;
  const [section, setSection] = useState<Section>(start);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [sheet, setSheet] = useState<any | null>(null);
  const [edit, setEdit] = useState('');
  const [edit2, setEdit2] = useState('');

  const [pets, setPets] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [needs, setNeeds] = useState<any[]>([]);
  const [helpers, setHelpers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);

  const fail = (e: any, fallback: string) => {
    const raw = String(e?.message || fallback);
    const message = /organizations_status_check/i.test(raw)
      ? 'Organization status must be pending, approved, rejected, or suspended.'
      : /organizations_org_type_check/i.test(raw)
        ? 'Organization type is not allowed. Use shelter, rescue_group, clinic, or sponsor.'
        : raw;
    setBanner({ kind: 'error', message });
  };
  const acting = actingAs ? actingLabel(actingAs) : 'platform_admin';

  const audit = async (action: string, targetType: string, targetId?: string, meta?: Record<string, unknown>) => {
    if (!user) return;
    await logAudit({ actorId: user.id, actingAs: acting, action, targetType, targetId, meta });
  };

  const load = useCallback(async (sec: Section) => {
    if (!user || !actingIsPlatform) { setLoading(false); return; }
    setLoading(true);
    try {
      if (sec === 'pets' || sec === 'home') {
        const { data, error } = await supabase.from('pets')
          .select('id, name, species, listing_type, status, owner_id, main_photo_url, is_public, shelter_id, created_at')
          .order('created_at', { ascending: false }).limit(200);
        if (error) fail(error, 'Could not load pets.');
        else setPets(data || []);
      }
      if (sec === 'reports' || sec === 'home') {
        const { data, error } = await supabase.from('reports')
          .select('id, report_type, status, pet_name, location_address, created_at, description')
          .order('created_at', { ascending: false }).limit(200);
        if (error) fail(error, 'Could not load reports.');
        else setReports(data || []);
      }
      if (sec === 'trends' || sec === 'home') {
        const { data: n } = await supabase.from('community_needs').select('*').order('created_at', { ascending: false }).limit(80);
        setNeeds(n || []);
        const { data: h } = await supabase.from('helper_status')
          .select('user_id, on_duty, services, radius_mi, geohash, until_at').eq('on_duty', true).limit(80);
        const ids = (h || []).map((x: any) => x.user_id);
        const { data: names } = ids.length ? await supabase.from('profiles').select('id, full_name, email').in('id', ids) : { data: [] as any[] };
        const nmap: Record<string, any> = {};
        (names || []).forEach((p: any) => { nmap[p.id] = p; });
        setHelpers(((h || []) as any[]).map((x) => ({ ...x, profile: nmap[x.user_id] })));
        const { data: r } = await supabase.from('help_requests').select('*').order('created_at', { ascending: false }).limit(80);
        setRequests(r || []);
      }
      if (sec === 'members' || sec === 'home') {
        const { data, error } = await supabase.from('profiles')
          .select('id, email, full_name, role, blocked').order('email').limit(200);
        if (error) fail(error, 'Could not load members.');
        else setMembers(data || []);
      }
      if (sec === 'orgs' || sec === 'home') {
        const { data, error } = await supabase.from('organizations')
          .select('id, name, org_type, status, website, contact_email, ein_verified, data_source')
          .order('name').limit(200);
        if (error) fail(error, 'Could not load organizations.');
        else setOrgs(data || []);
      }
      if (sec === 'issues' || sec === 'home') {
        const [{ data: bugs }, { data: ticks }, { data: mq }] = await Promise.all([
          supabase.from('bug_reports').select('id, title, body, status, assignee_id, reply, created_at, reporter_id').order('created_at', { ascending: false }).limit(80),
          supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(80),
          supabase.from('moderation_queue').select('id, subject_type, subject_id, flag_reason, status, created_at').order('created_at', { ascending: false }).limit(80),
        ]);
        const rows = [
          ...((bugs || []) as any[]).map((b) => ({ kind: 'bug', id: b.id, title: b.title || 'Bug', body: b.body, status: b.status, assignee_id: b.assignee_id, reply: b.reply, created_at: b.created_at })),
          ...((ticks || []) as any[]).map((t) => ({ kind: 'ticket', id: t.id, title: t.subject, body: t.body, status: t.status, assignee_id: t.assignee_id, reply: t.reply, user_id: t.user_id, created_at: t.created_at })),
          ...((mq || []) as any[]).map((m) => ({ kind: 'flag', id: m.id, title: `${m.subject_type} · ${m.flag_reason || 'flag'}`, body: m.subject_id, status: m.status, created_at: m.created_at })),
        ].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        setIssues(rows);
      }
    } finally {
      setLoading(false);
    }
  }, [user, actingIsPlatform]);

  useEffect(() => { if (!authLoading) load(section === 'home' ? 'home' : section); }, [authLoading, section, load]);

  const match = (hay: string, needle: string) => hay.toLowerCase().includes(needle.trim().toLowerCase());

  const filteredPets = useMemo(() => pets.filter((p) => {
    if (filter === 'hidden' && !p.hidden) return false;
    if (filter === 'adoptable' && p.listing_type !== 'adoptable') return false;
    if (filter === 'private' && p.listing_type !== 'private') return false;
    if (q && !match(`${p.name || ''} ${p.species || ''} ${p.id}`, q)) return false;
    return true;
  }), [pets, q, filter]);

  const filteredReports = useMemo(() => reports.filter((r) => {
    if (filter !== 'all' && (r.status || '').toLowerCase() !== filter && (r.severity || '').toLowerCase() !== filter) return false;
    if (q && !match(`${r.pet_name || ''} ${r.report_type || ''} ${r.location_address || ''} ${r.description || ''}`, q)) return false;
    return true;
  }), [reports, q, filter]);

  const filteredMembers = useMemo(() => members.filter((m) => {
    if (filter === 'blocked' && !m.blocked) return false;
    if (filter === 'admin' && m.role !== 'platform_admin') return false;
    if (q && !match(`${m.email || ''} ${m.full_name || ''}`, q)) return false;
    return true;
  }), [members, q, filter]);

  const filteredOrgs = useMemo(() => orgs.filter((o) => {
    if (filter !== 'all' && (o.status || '').toLowerCase() !== filter) return false;
    if (q && !match(`${o.name || ''} ${o.org_type || ''} ${o.contact_email || ''}`, q)) return false;
    return true;
  }), [orgs, q, filter]);

  const filteredIssues = useMemo(() => issues.filter((i) => {
    if (filter !== 'all' && i.kind !== filter && (i.status || '') !== filter) return false;
    if (q && !match(`${i.title || ''} ${i.body || ''}`, q)) return false;
    return true;
  }), [issues, q, filter]);

  const filteredNeeds = useMemo(() => needs.filter((n) => {
    if (filter !== 'all' && n.status !== filter && !(filter === 'pinned' && n.pinned)) return false;
    if (q && !match(`${n.title || ''} ${n.body || ''}`, q)) return false;
    return true;
  }), [needs, q, filter]);

  const go = (s: Section) => { setSection(s); setQ(''); setFilter('all'); setSheet(null); };

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      setBanner({ kind: 'success', message: ok });
      setSheet(null);
      await load(section);
    } catch (e: any) {
      fail(e, 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.wrap} edges={['top']}>
        <AppHeader title="Platform" showBack />
        <ActivityIndicator color={Colors.coral} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }
  if (!user) { router.replace('/auth'); return null; }
  if (!actingIsPlatform) {
    return (
      <SafeAreaView style={styles.wrap} edges={['top']}>
        <AppHeader title="Platform" showBack />
        <Page>
          <Text style={styles.meta}>Platform console is for Rescue Army administrators only.</Text>
        </Page>
      </SafeAreaView>
    );
  }

  const title = section === 'home' ? 'Platform' : (SECTIONS.find((s) => s.key === section)?.label || 'Platform');
  const counts = {
    pets: pets.length, reports: reports.filter((r) => (r.status || 'active') !== 'resolved').length,
    trends: needs.filter((n) => n.status === 'open' || n.pinned).length + helpers.length,
    members: members.length, orgs: orgs.length,
    issues: issues.filter((i) => !['resolved', 'closed', 'approved', 'wontfix'].includes(i.status)).length,
  };

  const Filters = ({ options }: { options: string[] }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {options.map((o) => (
        <TouchableOpacity key={o} onPress={() => setFilter(o)} style={[styles.filterChip, filter === o && styles.filterOn]}>
          <Text style={[styles.filterTxt, filter === o && styles.filterTxtOn]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const SearchBar = ({ placeholder }: { placeholder: string }) => (
    <View style={styles.search}>
      <Search color={Colors.textTertiary} size={16} />
      <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder={placeholder} placeholderTextColor={Colors.textTertiary} />
      {q ? <TouchableOpacity onPress={() => setQ('')}><X color={Colors.textTertiary} size={16} /></TouchableOpacity> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <AppHeader title={title} showBack />
      <Page>
        {banner ? <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} /> : null}
        {section !== 'home' ? (
          <TouchableOpacity onPress={() => go('home')}><Text style={styles.backLink}>← All sections</Text></TouchableOpacity>
        ) : null}

        {section === 'home' ? (
          <>
            <View style={styles.navyHero}>
              <Text style={styles.navyTitle}>Platform</Text>
              <Text style={styles.navySub}>Rescue Army admin · every action is audit-logged</Text>
              <View style={styles.countRow}>
                {SECTIONS.map((s) => (
                  <View key={s.key} style={styles.countCell}>
                    <Text style={styles.countN}>{counts[s.key as keyof typeof counts] ?? 0}</Text>
                    <Text style={styles.countL}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.grid}>
              {SECTIONS.map((s) => (
                <TouchableOpacity key={s.key} style={styles.tile} onPress={() => go(s.key)} activeOpacity={0.85}>
                  <View style={[styles.tileIcon, { backgroundColor: s.bg }]}>
                    <s.Icon color={s.tint} size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tileLabel}>{s.label}</Text>
                    <Text style={styles.tileSub} numberOfLines={1}>{s.sub}</Text>
                  </View>
                  <Text style={styles.tileN}>{counts[s.key as keyof typeof counts] ?? 0}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {section === 'pets' ? (
          <>
            <SearchBar placeholder="Search pets" />
            <Filters options={['all', 'private', 'adoptable', 'hidden']} />
            {loading ? <ActivityIndicator color={Colors.coral} /> : null}
            {filteredPets.map((p) => (
              <TouchableOpacity key={p.id} style={styles.row} onPress={() => { setSheet({ kind: 'pet', row: p }); setEdit(p.name || ''); setEdit2(''); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{p.name || 'Unnamed'}</Text>
                  <Text style={styles.meta}>{p.species || 'Pet'} · {p.listing_type || 'private'}{p.hidden ? ' · hidden' : ''}</Text>
                </View>
                <Pill label={p.status || '—'} ok={p.status === 'available'} />
              </TouchableOpacity>
            ))}
            {!loading && filteredPets.length === 0 ? <Text style={styles.meta}>No pets match.</Text> : null}
          </>
        ) : null}

        {section === 'reports' ? (
          <>
            <SearchBar placeholder="Search reports" />
            <Filters options={['all', 'active', 'resolved', 'critical', 'urgent', 'standard']} />
            {loading ? <ActivityIndicator color={Colors.coral} /> : null}
            {filteredReports.map((r) => (
              <TouchableOpacity key={r.id} style={styles.row} onPress={() => { setSheet({ kind: 'report', row: r }); setEdit(''); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.pet_name || r.report_type} · {r.report_type}</Text>
                  <Text style={styles.meta} numberOfLines={1}>{r.location_address} · {r.status}</Text>
                </View>
                <Pill label={r.severity || 'standard'} warn={r.severity === 'urgent'} ok={r.status === 'resolved'} />
              </TouchableOpacity>
            ))}
            {!loading && filteredReports.length === 0 ? <Text style={styles.meta}>No reports match.</Text> : null}
          </>
        ) : null}

        {section === 'trends' ? (
          <>
            <SearchBar placeholder="Search needs" />
            <Filters options={['all', 'open', 'pinned', 'expired']} />
            <Text style={styles.kicker}>Community needs</Text>
            {filteredNeeds.map((n) => (
              <TouchableOpacity key={n.id} style={styles.row} onPress={() => { setSheet({ kind: 'need', row: n }); setEdit(n.title); setEdit2(n.body || ''); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{n.title}</Text>
                  <Text style={styles.meta}>{n.status}{n.pinned ? ' · pinned' : ''}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.ghost} onPress={() => { setSheet({ kind: 'need', row: null }); setEdit(''); setEdit2(''); }}>
              <Text style={styles.ghostTxt}>+ New need</Text>
            </TouchableOpacity>
            <Text style={styles.kicker}>Helpers on duty · {helpers.length}</Text>
            {helpers.map((h) => (
              <View key={h.user_id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{h.profile?.full_name || h.profile?.email || h.user_id.slice(0, 8)}</Text>
                  <Text style={styles.meta}>{(h.services || []).join(', ')} · {h.radius_mi} mi · {h.geohash}</Text>
                </View>
              </View>
            ))}
            <Text style={styles.kicker}>Help requests</Text>
            {requests.map((r) => (
              <TouchableOpacity key={r.id} style={styles.row} onPress={() => setSheet({ kind: 'help', row: r })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{r.service || 'Help'} · {r.status}</Text>
                  <Text style={styles.meta}>{r.note || r.id.slice(0, 8)}</Text>
                </View>
                <Pill label={r.status} ok={r.status === 'done'} warn={r.status === 'pending'} />
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {section === 'members' ? (
          <>
            <SearchBar placeholder="Search email or name" />
            <Filters options={['all', 'admin', 'blocked']} />
            {filteredMembers.map((m) => (
              <TouchableOpacity key={m.id} style={styles.row} onPress={() => { setSheet({ kind: 'member', row: m }); setEdit(m.email || ''); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{m.full_name || m.email}</Text>
                  <Text style={styles.meta}>{m.email} · {m.role || 'member'}{m.blocked ? ' · blocked' : ''}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {section === 'orgs' ? (
          <>
            <SearchBar placeholder="Search organizations" />
            <Filters options={['all', 'pending', 'approved', 'suspended', 'rejected']} />
            {filteredOrgs.map((o) => (
              <TouchableOpacity key={o.id} style={styles.row} onPress={() => { setSheet({ kind: 'org', row: o }); setEdit(''); setEdit2(''); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{o.name}</Text>
                  <Text style={styles.meta}>{o.org_type || 'org'} · {o.status} · {o.rg_sync_status || o.data_source || 'no sync'}</Text>
                </View>
                <Pill label={o.ein_verified ? 'EIN ok' : 'EIN?'} ok={!!o.ein_verified} warn={!o.ein_verified} />
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {section === 'issues' ? (
          <>
            <SearchBar placeholder="Search issues" />
            <Filters options={['all', 'bug', 'ticket', 'flag', 'open', 'pending']} />
            {filteredIssues.map((i) => (
              <TouchableOpacity key={`${i.kind}-${i.id}`} style={styles.row} onPress={() => { setSheet({ kind: 'issue', row: i }); setEdit(i.reply || ''); }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{i.title}</Text>
                  <Text style={styles.meta}>{i.kind} · {i.status}</Text>
                </View>
                <Pill label={i.status} ok={i.status === 'resolved' || i.status === 'approved'} />
              </TouchableOpacity>
            ))}
          </>
        ) : null}
      </Page>

      <Modal visible={!!sheet} animationType="slide" transparent onRequestClose={() => setSheet(null)}>
        <View style={styles.scrim}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView keyboardShouldPersistTaps="handled">
              {sheet?.kind === 'pet' ? <PetSheet row={sheet.row} edit={edit} setEdit={setEdit} edit2={edit2} setEdit2={setEdit2} busy={busy} run={run} audit={audit} router={router} onClose={() => setSheet(null)} /> : null}
              {sheet?.kind === 'report' ? <ReportSheet row={sheet.row} edit={edit} setEdit={setEdit} busy={busy} run={run} audit={audit} onClose={() => setSheet(null)} /> : null}
              {sheet?.kind === 'need' ? <NeedSheet row={sheet.row} edit={edit} setEdit={setEdit} edit2={edit2} setEdit2={setEdit2} busy={busy} run={run} audit={audit} userId={user.id} onClose={() => setSheet(null)} /> : null}
              {sheet?.kind === 'help' ? <HelpSheet row={sheet.row} busy={busy} run={run} audit={audit} onClose={() => setSheet(null)} /> : null}
              {sheet?.kind === 'member' ? <MemberSheet row={sheet.row} edit={edit} setEdit={setEdit} busy={busy} run={run} audit={audit} userId={user.id} pets={pets} reports={reports} onClose={() => setSheet(null)} /> : null}
              {sheet?.kind === 'org' ? <OrgSheet row={sheet.row} edit={edit} setEdit={setEdit} edit2={edit2} setEdit2={setEdit2} busy={busy} run={run} audit={audit} onClose={() => setSheet(null)} /> : null}
              {sheet?.kind === 'issue' ? <IssueSheet row={sheet.row} edit={edit} setEdit={setEdit} busy={busy} run={run} audit={audit} userId={user.id} onClose={() => setSheet(null)} /> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Act({ label, onPress, danger, busy }: { label: string; onPress: () => void; danger?: boolean; busy?: boolean }) {
  return (
    <TouchableOpacity style={[styles.act, danger && styles.actDanger]} onPress={onPress} disabled={busy}>
      <Text style={[styles.actTxt, danger && styles.actDangerTxt]}>{busy ? '…' : label}</Text>
    </TouchableOpacity>
  );
}

function PetSheet({ row, edit, setEdit, edit2, setEdit2, busy, run, audit, router, onClose }: any) {
  return (
    <>
      <Text style={styles.sheetTitle}>{row.name || 'Pet'}</Text>
      <Text style={styles.meta}>{row.id}</Text>
      <TextInput style={styles.input} value={edit} onChangeText={setEdit} placeholder="Name" />
      <Act label="Save name" busy={busy} onPress={() => run(async () => {
        const { error } = await supabase.from('pets').update({ name: edit.trim() }).eq('id', row.id);
        if (error) throw error;
        await audit('pet.edit', 'pet', row.id, { name: edit.trim() });
      }, 'Pet updated.')} />
      <Act label="Open record" onPress={() => { onClose(); router.push(`/pet-record?petId=${row.id}`); }} />
      <TextInput style={styles.input} value={edit2} onChangeText={setEdit2} placeholder="Reassign owner (email)" autoCapitalize="none" />
      <Act label="Reassign owner" busy={busy} onPress={() => run(async () => {
        const { data: ppl, error: e1 } = await supabase.from('profiles').select('id').ilike('email', edit2.trim().toLowerCase()).maybeSingle();
        if (e1 || !ppl) throw e1 || new Error('No user with that email.');
        const { error } = await supabase.from('pets').update({ owner_id: ppl.id, listing_type: 'private', is_public: false }).eq('id', row.id);
        if (error) throw error;
        await audit('pet.reassign', 'pet', row.id, { owner_id: ppl.id });
      }, 'Owner reassigned.')} />
      <Act label={row.hidden ? 'Unhide' : 'Hide from listings'} busy={busy} onPress={() => run(async () => {
        const { error } = await supabase.from('pets').update({ hidden: !row.hidden, is_public: row.hidden ? row.is_public : false }).eq('id', row.id);
        if (error) throw error;
        await audit(row.hidden ? 'pet.unhide' : 'pet.hide', 'pet', row.id);
      }, row.hidden ? 'Unhidden.' : 'Hidden.')} />
      <TextInput style={styles.input} value={edit2} onChangeText={setEdit2} placeholder="Merge into pet id (keep that one)" autoCapitalize="none" />
      <Act label="Merge duplicate into that id" busy={busy} danger onPress={() => run(async () => {
        const keep = edit2.trim();
        if (!keep) throw new Error('Paste the pet id to keep.');
        const { error } = await supabase.rpc('platform_merge_pets', { keep_id: keep, drop_id: row.id });
        if (error) {
          const { error: e2 } = await supabase.from('pets').update({ merged_into: keep, hidden: true, listing_type: 'private', is_public: false }).eq('id', row.id);
          if (e2) throw error;
        }
        await audit('pet.merge', 'pet', row.id, { keep });
      }, 'Merged.')} />
      <Act label="Delete pet" danger busy={busy} onPress={() => run(async () => {
        const { error } = await supabase.from('pets').delete().eq('id', row.id);
        if (error) throw error;
        await audit('pet.delete', 'pet', row.id);
      }, 'Deleted.')} />
      <Act label="Close" onPress={onClose} />
    </>
  );
}

function ReportSheet({ row, edit, setEdit, busy, run, audit, onClose }: any) {
  const setStatus = (status: string) => run(async () => {
    const { error } = await supabase.from('reports').update({ status }).eq('id', row.id);
    if (error) throw error;
    await audit('report.status', 'report', row.id, { status });
  }, `Marked ${status}.`);
  return (
    <>
      <Text style={styles.sheetTitle}>{row.pet_name || row.report_type}</Text>
      <Text style={styles.meta}>{row.location_address} · {row.severity || 'standard'}</Text>
      <Text style={styles.body}>{row.description}</Text>
      <View style={styles.actRow}>
        <Act label="Approve / open" busy={busy} onPress={() => setStatus('active')} />
        <Act label="Reject" danger busy={busy} onPress={() => setStatus('closed')} />
      </View>
      <View style={styles.actRow}>
        {['critical', 'urgent', 'standard'].map((s) => (
          <Act key={s} label={s} busy={busy} onPress={() => run(async () => {
            const { error } = await supabase.from('reports').update({ severity: s }).eq('id', row.id);
            if (error) throw error;
            await audit('report.severity', 'report', row.id, { severity: s });
          }, `Severity ${s}.`)} />
        ))}
      </View>
      <Act label="Resolve" busy={busy} onPress={() => setStatus('resolved')} />
      <TextInput style={styles.input} value={edit} onChangeText={setEdit} placeholder="Assign responder (email)" autoCapitalize="none" />
      <Act label="Assign responder" busy={busy} onPress={() => run(async () => {
        const { data: ppl, error: e1 } = await supabase.from('profiles').select('id').ilike('email', edit.trim().toLowerCase()).maybeSingle();
        if (e1 || !ppl) throw e1 || new Error('No user with that email.');
        const { error } = await supabase.from('reports').update({ assigned_to: ppl.id, status: 'active' }).eq('id', row.id);
        if (error) throw error;
        await audit('report.assign', 'report', row.id, { assigned_to: ppl.id });
      }, 'Responder assigned.')} />
      <Act label="Flag false → suspend reporter" danger busy={busy} onPress={() => run(async () => {
        const { error } = await supabase.from('reports').update({ false_report: true, status: 'closed' }).eq('id', row.id);
        if (error) throw error;
        if (row.user_id) {
          const { error: e2 } = await supabase.from('profiles').update({ blocked: true }).eq('id', row.user_id);
          if (e2) throw e2;
          await audit('member.block', 'user', row.user_id, { reason: 'false_report', report: row.id });
        }
        await audit('report.false', 'report', row.id);
      }, 'Flagged false and reporter suspended.')} />
      <Act label="Close" onPress={onClose} />
    </>
  );
}

function NeedSheet({ row, edit, setEdit, edit2, setEdit2, busy, run, audit, userId, onClose }: any) {
  return (
    <>
      <Text style={styles.sheetTitle}>{row ? 'Edit need' : 'New need'}</Text>
      <TextInput style={styles.input} value={edit} onChangeText={setEdit} placeholder="Title" />
      <TextInput style={[styles.input, { minHeight: 80 }]} value={edit2} onChangeText={setEdit2} placeholder="Details" multiline />
      <Act label="Save" busy={busy} onPress={() => run(async () => {
        if (!edit.trim()) throw new Error('Title required.');
        if (row?.id) {
          const { error } = await supabase.from('community_needs').update({ title: edit.trim(), body: edit2 }).eq('id', row.id);
          if (error) throw error;
          await audit('need.update', 'community_need', row.id);
        } else {
          const { data, error } = await supabase.from('community_needs').insert({ title: edit.trim(), body: edit2, created_by: userId, status: 'open' }).select('id').maybeSingle();
          if (error) throw error;
          await audit('need.create', 'community_need', data?.id);
        }
      }, 'Saved.')} />
      {row?.id ? (
        <>
          <Act label={row.pinned ? 'Unpin' : 'Pin'} busy={busy} onPress={() => run(async () => {
            const { error } = await supabase.from('community_needs').update({ pinned: !row.pinned, status: row.pinned ? 'open' : 'pinned' }).eq('id', row.id);
            if (error) throw error;
            await audit('need.pin', 'community_need', row.id, { pinned: !row.pinned });
          }, row.pinned ? 'Unpinned.' : 'Pinned.')} />
          <Act label="Expire" busy={busy} onPress={() => run(async () => {
            const { error } = await supabase.from('community_needs').update({ status: 'expired', expires_at: new Date().toISOString(), pinned: false }).eq('id', row.id);
            if (error) throw error;
            await audit('need.expire', 'community_need', row.id);
          }, 'Expired.')} />
        </>
      ) : null}
      <Act label="Close" onPress={onClose} />
    </>
  );
}

function HelpSheet({ row, busy, run, audit, onClose }: any) {
  return (
    <>
      <Text style={styles.sheetTitle}>Help request</Text>
      <Text style={styles.meta}>{row.service} · {row.status}</Text>
      {['pending', 'accepted', 'declined', 'done'].map((st) => (
        <Act key={st} label={`Mark ${st}`} busy={busy} onPress={() => run(async () => {
          const { error } = await supabase.from('help_requests').update({ status: st, decided_at: new Date().toISOString() }).eq('id', row.id);
          if (error) throw error;
          await audit('help.status', 'help_request', row.id, { status: st });
        }, `Status ${st}.`)} />
      ))}
      <Act label="Close" onPress={onClose} />
    </>
  );
}

function MemberSheet({ row, edit, setEdit, busy, run, audit, userId, pets, reports, onClose }: any) {
  const theirs = (pets || []).filter((p: any) => p.owner_id === row.id);
  const theirsR = (reports || []).filter((r: any) => r.user_id === row.id);
  return (
    <>
      <Text style={styles.sheetTitle}>{row.full_name || row.email}</Text>
      <Text style={styles.meta}>{row.email} · {row.role || 'member'}</Text>
      <Act label={row.role === 'platform_admin' ? 'Make member' : 'Make platform admin'} busy={busy} onPress={() => run(async () => {
        const next = row.role === 'platform_admin' ? 'member' : 'platform_admin';
        const { error } = await supabase.from('profiles').update({ role: next }).eq('id', row.id);
        if (error) throw error;
        await audit('member.role', 'user', row.id, { role: next });
      }, 'Role updated.')} />
      <Act label={row.blocked ? 'Unblock' : 'Block'} danger={!row.blocked} busy={busy} onPress={() => run(async () => {
        const { error } = await supabase.from('profiles').update({ blocked: !row.blocked }).eq('id', row.id);
        if (error) throw error;
        await audit(row.blocked ? 'member.unblock' : 'member.block', 'user', row.id);
      }, row.blocked ? 'Unblocked.' : 'Blocked.')} />
      <Act label="Approve government ID" busy={busy} onPress={() => run(async () => {
        const { error } = await supabase.from('user_verifications').upsert({ user_id: row.id, id_status: 'verified', id_verified: true });
        if (error) throw error;
        await audit('member.id_approve', 'user', row.id);
      }, 'ID verified.')} />
      <Act label="Approve phone" busy={busy} onPress={() => run(async () => {
        const { error } = await supabase.from('user_verifications').upsert({ user_id: row.id, phone_verified: true });
        if (error) throw error;
        await audit('member.phone_approve', 'user', row.id);
      }, 'Phone verified.')} />
      <Act label="Mark training passed" busy={busy} onPress={() => run(async () => {
        const { error } = await supabase.from('user_verifications').upsert({ user_id: row.id, responder_training: 'passed' });
        if (error) throw error;
        await audit('member.training', 'user', row.id);
      }, 'Training passed.')} />
      <Act label="Upload ID for user" busy={busy} onPress={() => run(async () => {
        const pick = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
        if (pick.canceled || !pick.assets?.[0]) throw new Error('Canceled.');
        const blob = await (await fetch(pick.assets[0].uri)).blob();
        const path = `${row.id}/admin-${Date.now()}.jpg`;
        const { error: up } = await supabase.storage.from('identity-docs').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
        if (up) throw up;
        const { error } = await supabase.from('user_verifications').upsert({ user_id: row.id, id_document_path: path, id_status: 'submitted', id_verified: false });
        if (error) throw error;
        await audit('member.upload', 'user', row.id, { path });
      }, 'Uploaded.')} />
      <Act label="Send password reset" busy={busy} onPress={() => run(async () => {
        if (!row.email) throw new Error('No email on file.');
        const { error } = await supabase.auth.resetPasswordForEmail(row.email);
        if (error) throw error;
        await audit('member.reset', 'user', row.id);
      }, `Reset sent to ${row.email}.`)} />
      <Text style={styles.kicker}>Pets · {theirs.length}</Text>
      {theirs.slice(0, 8).map((p: any) => <Text key={p.id} style={styles.meta}>{p.name || p.id}</Text>)}
      <Text style={styles.kicker}>Reports · {theirsR.length}</Text>
      {theirsR.slice(0, 8).map((r: any) => <Text key={r.id} style={styles.meta}>{r.report_type} · {r.status}</Text>)}
      <Act label="Close" onPress={onClose} />
    </>
  );
}

function OrgSheet({ row, edit, setEdit, edit2, setEdit2, busy, run, audit, onClose }: any) {
  return (
    <>
      <Text style={styles.sheetTitle}>{row.name}</Text>
      <Text style={styles.meta}>{row.org_type} · {row.status} · RG {row.rg_sync_status || row.data_source || 'none'}</Text>
      {row.rg_synced_at ? <Text style={styles.meta}>Last sync {String(row.rg_synced_at).slice(0, 16)}</Text> : null}
      <Act label="Suspend" danger busy={busy} onPress={() => run(async () => {
        const { error } = await supabase.from('organizations').update({ status: 'suspended' }).eq('id', row.id);
        if (error) throw error;
        await audit('org.suspend', 'organization', row.id);
      }, 'Suspended.')} />
      <Act label="Approve" busy={busy} onPress={() => run(async () => {
        const { error } = await supabase.from('organizations').update({ status: 'approved' }).eq('id', row.id);
        if (error) throw error;
        await audit('org.approve', 'organization', row.id);
      }, 'Approved.')} />
      <Act label="Check EIN" busy={busy} onPress={() => run(async () => {
        const { data: priv } = await supabase.from('organization_private').select('ein').eq('organization_id', row.id).maybeSingle();
        const ein = String(priv?.ein || '').replace(/\D/g, '');
        const ok = ein.length === 9;
        const { error } = await supabase.from('organizations').update({ ein_verified: ok }).eq('id', row.id);
        if (error) throw error;
        await audit('org.ein_check', 'organization', row.id, { ok, last4: ein.slice(-4) });
        if (!ok) throw new Error(priv?.ein ? `EIN on file is not 9 digits (••${ein.slice(-4) || 'none'}).` : 'No EIN on file.');
      }, 'EIN format verified (9 digits).')} />
      <TextInput style={styles.input} value={edit} onChangeText={setEdit} placeholder="Add/remove org admin (email)" autoCapitalize="none" />
      <Act label="Add org admin" busy={busy} onPress={() => run(async () => {
        const { data: ppl, error: e1 } = await supabase.from('profiles').select('id').ilike('email', edit.trim().toLowerCase()).maybeSingle();
        if (e1 || !ppl) throw e1 || new Error('No user with that email.');
        const { error } = await supabase.from('organization_members').upsert({ organization_id: row.id, user_id: ppl.id, role: 'admin' });
        if (error) throw error;
        await audit('org.admin_add', 'organization', row.id, { user_id: ppl.id });
      }, 'Org admin added.')} />
      <Act label="Remove org admin" danger busy={busy} onPress={() => run(async () => {
        const { data: ppl } = await supabase.from('profiles').select('id').ilike('email', edit.trim().toLowerCase()).maybeSingle();
        if (!ppl) throw new Error('No user with that email.');
        const { error } = await supabase.from('organization_members').delete().eq('organization_id', row.id).eq('user_id', ppl.id).eq('role', 'admin');
        if (error) throw error;
        await audit('org.admin_remove', 'organization', row.id, { user_id: ppl.id });
      }, 'Org admin removed.')} />
      <TextInput style={styles.input} value={edit2} onChangeText={setEdit2} placeholder="Merge into org id (keep that one)" autoCapitalize="none" />
      <Act label="Merge into that org" danger busy={busy} onPress={() => run(async () => {
        const keep = edit2.trim();
        if (!keep) throw new Error('Paste the organization id to keep.');
        const { error } = await supabase.rpc('platform_merge_orgs', { keep_id: keep, drop_id: row.id });
        if (error) throw error;
        await audit('org.merge', 'organization', row.id, { keep });
      }, 'Merged.')} />
      <Act label="Mark RescueGroups synced" busy={busy} onPress={() => run(async () => {
        try { await fetch('/api/rescuegroups?org=' + encodeURIComponent(row.id)); } catch { /* optional */ }
        const { error } = await supabase.from('organizations').update({
          rg_sync_status: 'ok', rg_synced_at: new Date().toISOString(), data_source: 'rescuegroups',
        }).eq('id', row.id);
        if (error) throw error;
        await audit('org.rg_sync', 'organization', row.id);
      }, 'RescueGroups status updated.')} />
      <Act label="Close" onPress={onClose} />
    </>
  );
}

function IssueSheet({ row, edit, setEdit, busy, run, audit, userId, onClose }: any) {
  const table = row.kind === 'bug' ? 'bug_reports' : row.kind === 'ticket' ? 'support_tickets' : 'moderation_queue';
  const setStatus = (status: string) => run(async () => {
    const { error } = await supabase.from(table).update({ status }).eq('id', row.id);
    if (error) throw error;
    await audit('issue.status', row.kind, row.id, { status });
  }, `Status ${status}.`);
  return (
    <>
      <Text style={styles.sheetTitle}>{row.title}</Text>
      <Text style={styles.meta}>{row.kind} · {row.status}</Text>
      {row.body ? <Text style={styles.body}>{row.body}</Text> : null}
      <View style={styles.actRow}>
        {['open', 'pending', 'resolved', 'closed'].map((st) => (
          <Act key={st} label={st} busy={busy} onPress={() => setStatus(st)} />
        ))}
      </View>
      <Act label="Assign to me" busy={busy} onPress={() => run(async () => {
        if (row.kind === 'flag') throw new Error('Flags have no assignee — set status instead.');
        const { error } = await supabase.from(table).update({ assignee_id: userId, status: 'pending' }).eq('id', row.id);
        if (error) throw error;
        await audit('issue.assign', row.kind, row.id, { assignee_id: userId });
      }, 'Assigned to you.')} />
      <TextInput style={[styles.input, { minHeight: 80 }]} value={edit} onChangeText={setEdit} placeholder="Reply" multiline />
      <Act label="Save reply" busy={busy} onPress={() => run(async () => {
        if (row.kind === 'flag') throw new Error('Use approve/reject on flags.');
        const { error } = await supabase.from(table).update({ reply: edit, status: 'pending' }).eq('id', row.id);
        if (error) throw error;
        await audit('issue.reply', row.kind, row.id);
      }, 'Reply saved.')} />
      {row.kind === 'flag' ? (
        <View style={styles.actRow}>
          <Act label="Approve" busy={busy} onPress={() => setStatus('approved')} />
          <Act label="Reject" danger busy={busy} onPress={() => setStatus('rejected')} />
        </View>
      ) : null}
      <Act label="Close" onPress={onClose} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  navyHero: { backgroundColor: '#26265E', borderRadius: 16, padding: 16, marginBottom: 14, gap: 8 },
  navyTitle: { fontFamily: INTERB, fontSize: 22, color: Colors.white, fontWeight: '800' },
  navySub: { fontFamily: INTER, fontSize: 13, color: '#B9BCE0' },
  countRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  countCell: { width: '30%', minWidth: 90, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8 },
  countN: { fontFamily: INTERB, fontSize: 20, color: Colors.white, fontWeight: '800' },
  countL: { fontFamily: INTER, fontSize: 11, color: '#B9BCE0', marginTop: 2 },
  hero: { fontFamily: INTERB, fontSize: 22, color: Colors.navy, fontWeight: '800' },
  heroSub: { fontFamily: INTER, fontSize: 13, color: Colors.textSecondary, marginBottom: 8 },
  grid: { gap: 10 },
  tile: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  tileIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: INTERB, fontSize: 15, color: Colors.navy, fontWeight: '700' },
  tileSub: { fontFamily: INTER, fontSize: 12, color: Colors.textSecondary },
  tileN: { fontFamily: INTERB, fontSize: 18, color: Colors.navy, fontWeight: '800' },
  kicker: { fontFamily: INTERB, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 12, fontWeight: '800' },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white,
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 12, minHeight: 44,
  },
  searchInput: { flex: 1, fontFamily: INTER, fontSize: 14, color: Colors.text, paddingVertical: RNPlatform.OS === 'web' ? 8 : 10 },
  filters: { gap: 8, paddingVertical: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surface, marginRight: 8 },
  filterOn: { backgroundColor: Colors.navy },
  filterTxt: { fontFamily: INTERB, fontSize: 12, color: Colors.textSecondary, fontWeight: '700', textTransform: 'capitalize' },
  filterTxtOn: { color: Colors.white },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white,
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: Colors.border, minHeight: 44,
  },
  name: { fontFamily: INTERB, fontSize: 14, color: Colors.navy, fontWeight: '700' },
  meta: { fontFamily: INTER, fontSize: 12, color: Colors.textSecondary },
  body: { fontFamily: INTER, fontSize: 13, color: Colors.textBody, lineHeight: 18, marginVertical: 8 },
  pill: { fontFamily: INTERB, fontSize: 10.5, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', fontWeight: '700' },
  input: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: RNPlatform.OS === 'web' ? 10 : 12, fontFamily: INTER, color: Colors.text, backgroundColor: Colors.white, marginBottom: 8,
  },
  ghost: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: Colors.white },
  ghostTxt: { fontFamily: INTERB, color: Colors.navy, fontWeight: '700' },
  backLink: { fontFamily: INTERB, color: Colors.tealDark, fontSize: 13, fontWeight: '700' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32, maxHeight: '88%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontFamily: INTERB, fontSize: 18, color: Colors.navy, fontWeight: '800', marginBottom: 4 },
  act: { minHeight: 44, borderRadius: 12, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center', marginBottom: 8, paddingHorizontal: 12 },
  actTxt: { color: Colors.white, fontFamily: INTERB, fontWeight: '700' },
  actDanger: { backgroundColor: Colors.white, borderWidth: 1.5, borderColor: Colors.critical },
  actDangerTxt: { color: Colors.critical },
  actRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
