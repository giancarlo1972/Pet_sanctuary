import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Linking, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Search, Shield } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/AppHeader';
import { SegmentedTabs } from '@/components/Tabs';
import { Page } from '@/components/Page';
import SignedImage from '@/components/SignedImage';
import { DashboardPanel } from '@/components/DashboardPanel';
import { SUPPORT_EMAIL } from '@/lib/contact';
import { useAuth } from '@/lib/context/AuthContext';
import { isUsablePhoto } from '@/lib/photos';

const TYPE_LABEL: Record<string, string> = {
  lost: 'Lost pet',
  stray: 'Found stray',
  injured: 'Injured',
  road_accident: 'Road accident',
  cruelty: 'Cruelty',
  emergency: 'Emergency',
  lost_found: 'Lost or found',
};

const SEV: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: Colors.criticalBg, color: Colors.critical, label: 'CRITICAL' },
  urgent: { bg: Colors.urgentBg, color: Colors.urgent, label: 'URGENT' },
  standard: { bg: Colors.standardBg, color: Colors.accentDark, label: 'STANDARD' },
};

function timeAgo(dateString: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

function shortPlace(addr: string) {
  const s = (addr || '').replace(/^Detected:\s*/i, '').replace(/^Current location.*/, '').trim();
  if (!s) return '';
  return s.split(',').slice(0, 2).join(',').trim();
}

function titleFor(r: {
  pet_name: string | null;
  location_address: string;
  report_type: string;
  animal_kind?: string | null;
  ai_species?: string | null;
}) {
  const type = TYPE_LABEL[r.report_type] || 'Report';
  const animal = (r.pet_name || r.animal_kind || r.ai_species || '').trim();
  const place = shortPlace(r.location_address);
  if (animal && place) return `${type} — ${animal}, ${place}`;
  if (animal) return `${type} — ${animal}`;
  if (place) return `${type} — ${place}`;
  return type;
}

function photoOf(r: { photo_url?: string | null; photo_urls?: string[] | null }) {
  const first = r.photo_url || r.photo_urls?.[0] || null;
  return isUsablePhoto(first) ? first : null;
}

function statusChip(status: string): { label: string; bg: string; color: string } {
  if (status === 'active' || status === 'open') return { label: 'Active', bg: Colors.tealBg, color: Colors.tealDark };
  if (status === 'pending_moderation' || status === 'pending') return { label: 'Under review', bg: Colors.surfaceAlt, color: Colors.textSecondary };
  if (status === 'resolved') return { label: 'Resolved', bg: Colors.tealBg, color: Colors.tealDark };
  return { label: status.replace(/_/g, ' '), bg: Colors.surface, color: Colors.textSecondary };
}

type MainTab = 'reports' | 'fund';
type Filter = 'all' | 'critical' | 'urgent' | 'mine';

const CAMPAIGNS = [
  {
    id: 'aspca',
    org: 'ASPCA',
    title: 'ASPCA — national rescue & cruelty response',
    location: 'United States',
    url: 'https://secure.aspca.org/donate/donate',
    national: true,
  },
  {
    id: 'peta',
    org: 'PETA',
    title: 'PETA — investigations & rescue fund',
    location: 'United States',
    url: 'https://support.peta.org/page/73414/donate/1?locale=en-US',
    national: true,
  },
  {
    id: 'humane',
    org: 'Humane World for Animals',
    title: 'Humane World (formerly HSUS)',
    location: 'Worldwide',
    url: 'https://www.humaneworld.org/en/ways-to-give',
    national: true,
  },
  {
    id: 'nepal',
    org: 'Nepal partner',
    title: 'Nepal Flood Tragedy 2026',
    location: 'Nepal',
    url: '',
    national: false,
  },
];

export default function ReportsTabScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<MainTab>(params.tab === 'fund' ? 'fund' : 'reports');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.tab === 'fund') setTab('fund');
  }, [params.tab]);

  const loadReports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('id, report_type, severity, status, pet_name, location_address, created_at, description, photo_url, photo_urls, animal_kind, ai_species, user_id')
        .in('status', ['active', 'open', 'pending_moderation'])
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      setReports(data || []);
    } catch {
      try {
        const { data } = await supabase
          .from('reports')
          .select('id, report_type, severity, status, pet_name, location_address, created_at, description')
          .in('status', ['active', 'open', 'pending_moderation'])
          .order('created_at', { ascending: false })
          .limit(80);
        setReports(data || []);
      } catch {
        setReports([]);
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);
  useFocusEffect(useCallback(() => { loadReports(); }, [loadReports]));

  const counts = useMemo(() => {
    const sev = (r: any) => String(r.severity || '').toLowerCase();
    return {
      all: reports.length,
      critical: reports.filter((r) => sev(r) === 'critical').length,
      urgent: reports.filter((r) => sev(r) === 'urgent').length,
      mine: user?.id ? reports.filter((r) => r.user_id === user.id).length : 0,
    };
  }, [reports, user?.id]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      const sev = String(r.severity || '').toLowerCase();
      if (filter === 'critical' && sev !== 'critical') return false;
      if (filter === 'urgent' && sev !== 'urgent') return false;
      if (filter === 'mine') {
        if (!user?.id || r.user_id !== user.id) return false;
      }
      if (!q) return true;
      const hay = `${titleFor(r)} ${r.description || ''} ${TYPE_LABEL[r.report_type] || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [reports, filter, query, user?.id]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Reports" />
      <Page
        refreshControl={tab === 'reports' ? (
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReports(); }} colors={[Colors.coral]} />
        ) : undefined}
      >
          <SegmentedTabs
            items={[
              { key: 'reports', label: 'Reports' },
              { key: 'fund', label: 'Care Fund' },
            ]}
            value={tab}
            onChange={setTab}
          />
      {tab === 'fund' ? (
        <>
          <CareFund />
        </>
      ) : (
        <>
          <DashboardPanel
            tiles={[
              { key: 'all', label: 'All', value: counts.all, selected: filter === 'all', onPress: () => setFilter('all') },
              { key: 'critical', label: 'Critical', value: counts.critical, tint: 'risk', selected: filter === 'critical', onPress: () => setFilter('critical') },
              { key: 'urgent', label: 'Urgent', value: counts.urgent, tint: 'warn', selected: filter === 'urgent', onPress: () => setFilter('urgent') },
              { key: 'mine', label: 'Mine', value: counts.mine, selected: filter === 'mine', onPress: () => setFilter('mine') },
            ]}
          />

          <View style={styles.searchBox}>
            <Search color={Colors.textTertiary} size={16} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search reports..."
              placeholderTextColor={Colors.textTertiary}
            />
          </View>

          <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/report')} activeOpacity={0.85}>
            <Text style={styles.newBtnText}>New report</Text>
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.coral} style={{ marginTop: 40 }} />
          ) : filter === 'mine' && !user ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Sign in to see your reports</Text>
              <Text style={styles.emptySubtitle}>Reports you file will show up here.</Text>
              <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/auth')} activeOpacity={0.85}>
                <Text style={styles.signInText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          ) : visible.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptySubtitle}>File the first one with a photo. AI will draft the details for you to confirm.</Text>
            </View>
          ) : visible.map((r) => {
            const sev = SEV[r.severity || 'standard'] || SEV.standard;
            const st = statusChip(r.status || '');
            const photo = photoOf(r);
            return (
              <TouchableOpacity key={r.id} style={styles.card} onPress={() => router.push(`/report-details?id=${r.id}`)} activeOpacity={0.85}>
                {photo ? (
                  <View style={styles.cardPhotoWrap}>
                    <SignedImage path={photo} style={styles.cardPhoto} />
                  </View>
                ) : (
                  <View style={[styles.cardPhotoWrap, styles.cardPhotoEmpty]}>
                    <Text style={styles.cardPhotoLetter}>{(TYPE_LABEL[r.report_type] || 'R')[0]}</Text>
                  </View>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <View style={[styles.sev, { backgroundColor: sev.bg }]}>
                      <Text style={[styles.sevText, { color: sev.color }]}>{sev.label}</Text>
                    </View>
                    <Text style={styles.ago}>{timeAgo(r.created_at)}</Text>
                  </View>
                  <Text style={styles.title} numberOfLines={2}>{titleFor(r)}</Text>
                  <Text style={styles.desc} numberOfLines={2}>{r.description}</Text>
                  <View style={styles.pills}>
                    <View style={styles.pill}><Text style={styles.pillText}>{TYPE_LABEL[r.report_type] || r.report_type}</Text></View>
                    <View style={[styles.pill, { backgroundColor: st.bg }]}><Text style={[styles.pillText, { color: st.color }]}>{st.label}</Text></View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.note}>
            <Shield color={Colors.textSecondary} size={16} />
            <Text style={styles.noteText}>All reports are reviewed by moderators. Exact locations are visible only to verified responders — the public map shows an approximate area.</Text>
          </View>
          <TouchableOpacity onPress={() => setTab('fund')} activeOpacity={0.8}>
            <Text style={styles.fundLink}>Donate via Care Fund →</Text>
          </TouchableOpacity>
        </>
      )}
      </Page>
    </SafeAreaView>
  );
}

function CareFund() {
  const national = CAMPAIGNS.filter((c) => c.national);
  const local = CAMPAIGNS.filter((c) => !c.national);

  return (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>CARE FUND · UNITED EFFORTS</Text>
        <Text style={styles.heroTitle}>One hub. Their wallets.</Text>
        <Text style={styles.heroBody}>
          Rescue Army opens ASPCA, PETA, Humane World, or a local partner PayPal. We never hold the money. App problems: {SUPPORT_EMAIL}
        </Text>
      </View>
      <Text style={styles.section}>National campaigns</Text>
      {national.map((c) => (
        <CampaignCard key={c.id} c={c} />
      ))}
      <Text style={styles.section}>Active incidents</Text>
      {local.map((c) => (
        <CampaignCard key={c.id} c={c} />
      ))}
    </View>
  );
}

function CampaignCard({ c }: { c: (typeof CAMPAIGNS)[number] }) {
  return (
    <View style={styles.fundCard}>
      <Text style={styles.fundLoc}>{c.location}</Text>
      <Text style={styles.fundTitle}>{c.title}</Text>
      <Text style={styles.fundOrg}>{c.org}</Text>
      {c.url ? (
        <TouchableOpacity style={styles.donateBtn} onPress={() => Linking.openURL(c.url)}>
          <Text style={styles.donateText}>Open {c.org} official donate page</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.waiting}>PayPal/Venmo opens when this partner connects a wallet. Rescue Army cannot take this gift.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  searchInput: { flex: 1, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, paddingVertical: 10 },
  newBtn: { backgroundColor: Colors.coral, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  newBtnText: { color: Colors.white, fontFamily: Fonts.bold, fontSize: FontSizes.md },
  card: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardPhotoWrap: { width: 88, minHeight: 112, backgroundColor: Colors.surface },
  cardPhoto: { width: 88, minHeight: 112, flex: 1 },
  cardPhotoEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardPhotoLetter: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.navy },
  cardBody: { flex: 1, padding: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sev: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  sevText: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.6 },
  ago: { fontSize: FontSizes.xs, color: Colors.textTertiary, fontFamily: Fonts.medium },
  title: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.navy, marginBottom: 4 },
  desc: { fontSize: 12.5, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 18, marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { backgroundColor: Colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: FontSizes.xs, fontFamily: Fonts.semibold, color: Colors.text },
  note: { backgroundColor: Colors.surface, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20 },
  fundLink: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, color: Colors.navy, textAlign: 'center', marginBottom: 8 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 8 },
  emptySubtitle: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },
  signInBtn: { marginTop: 14, backgroundColor: Colors.navy, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20 },
  signInText: { color: Colors.white, fontFamily: Fonts.bold },
  hero: { backgroundColor: Colors.navy, borderRadius: 16, padding: 16, marginBottom: 16 },
  heroKicker: { color: '#B9BCE0', fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1.2 },
  heroTitle: { color: Colors.white, fontFamily: Fonts.extrabold, fontSize: FontSizes.lg, marginTop: 8 },
  heroBody: { color: '#B9BCE0', fontFamily: Fonts.regular, fontSize: FontSizes.sm, lineHeight: 20, marginTop: 8 },
  section: { fontFamily: Fonts.extrabold, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  fundCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 12 },
  fundLoc: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.coral },
  fundTitle: { fontFamily: Fonts.extrabold, fontSize: FontSizes.md, color: Colors.navy, marginTop: 4 },
  fundOrg: { fontFamily: Fonts.bold, fontSize: FontSizes.sm, color: Colors.navy, marginTop: 6 },
  donateBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  donateText: { color: Colors.white, fontFamily: Fonts.bold, fontSize: FontSizes.sm },
  waiting: { marginTop: 10, fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
});
