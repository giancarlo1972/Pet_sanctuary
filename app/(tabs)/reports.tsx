import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/AppHeader';

const TYPE_LABEL: Record<string, string> = {
  lost: 'Lost pet', stray: 'Found stray', injured: 'Injured animal',
  road_accident: 'Road accident', cruelty: 'Cruelty/Neglect', emergency: 'Emergency',
};

const SEV: Record<string, { bar: string; bg: string; color: string; label: string }> = {
  critical: { bar: Colors.critical, bg: Colors.criticalBg, color: Colors.critical, label: 'CRITICAL' },
  urgent: { bar: Colors.urgent, bg: Colors.urgentBg, color: Colors.urgent, label: 'URGENT' },
  standard: { bar: Colors.accent, bg: Colors.standardBg, color: Colors.accentDark, label: 'STANDARD' },
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

function titleFor(r: { pet_name: string | null; location_address: string; report_type: string }) {
  const place = (r.location_address || '').replace(/^Current location.*/, '').trim();
  if (r.pet_name && place) return `${r.pet_name} — ${place}`;
  if (r.pet_name) return r.pet_name;
  if (place) return `${TYPE_LABEL[r.report_type] || 'Report'} · ${place}`;
  return TYPE_LABEL[r.report_type] || 'Animal report';
}

type Tab = 'reports' | 'fund';

export default function ReportsTabScreen() {
  const [tab, setTab] = useState<Tab>('reports');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('id, report_type, severity, status, pet_name, location_address, created_at, description')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) setReports(data);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);
  useFocusEffect(useCallback(() => { loadReports(); }, [loadReports]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Reports" />
      <View style={styles.segment}>
        <TouchableOpacity style={[styles.segBtn, tab === 'reports' && styles.segOn]} onPress={() => setTab('reports')}>
          <Text style={[styles.segText, tab === 'reports' && styles.segTextOn]}>Reports</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segBtn, tab === 'fund' && styles.segOn]} onPress={() => setTab('fund')}>
          <Text style={[styles.segText, tab === 'fund' && styles.segTextOn]}>Care Fund</Text>
        </TouchableOpacity>
      </View>

      {tab === 'fund' ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Care Fund</Text>
          <Text style={styles.emptySubtitle}>Emergency vet bills and transport. Coming next — donations still go to the shelter, not Rescue Army.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReports(); }} colors={[Colors.coral]} />}
        >
          <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/lost-stray-report')} activeOpacity={0.85}>
            <Text style={styles.newBtnText}>+  New report</Text>
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.coral} style={{ marginTop: 40 }} />
          ) : reports.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No reports yet</Text>
              <Text style={styles.emptySubtitle}>File the first one with a photo. AI will draft the details for you to confirm.</Text>
            </View>
          ) : reports.map((r) => {
            const sev = SEV[r.severity || 'standard'] || SEV.standard;
            return (
              <TouchableOpacity key={r.id} style={styles.card} onPress={() => router.push(`/report-details?id=${r.id}`)} activeOpacity={0.85}>
                <View style={[styles.bar, { backgroundColor: sev.bar }]} />
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <View style={[styles.sev, { backgroundColor: sev.bg }]}>
                      <Text style={[styles.sevText, { color: sev.color }]}>{sev.label}</Text>
                    </View>
                    <Text style={styles.ago}>{timeAgo(r.created_at)}</Text>
                  </View>
                  <Text style={styles.title}>{titleFor(r)}</Text>
                  <Text style={styles.desc} numberOfLines={2}>{r.description}</Text>
                  <View style={styles.pills}>
                    <View style={styles.pill}><Text style={styles.pillText}>{TYPE_LABEL[r.report_type] || r.report_type}</Text></View>
                    {r.status === 'active' ? (
                      <View style={[styles.pill, styles.pillMint]}><Text style={[styles.pillText, { color: Colors.tealDark }]}>Active</Text></View>
                    ) : (
                      <View style={styles.pill}><Text style={styles.pillText}>{r.status}</Text></View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.note}>
            <Text style={styles.noteText}>All reports are reviewed by moderators. Exact locations are visible only to verified responders — the public map shows an approximate area.</Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  segment: { flexDirection: 'row', margin: 16, backgroundColor: Colors.surface, borderRadius: 999, padding: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  segOn: { backgroundColor: Colors.navy },
  segText: { fontFamily: Fonts.bold, color: Colors.textSecondary },
  segTextOn: { color: Colors.white },
  newBtn: { backgroundColor: Colors.coral, borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginBottom: 14 },
  newBtnText: { color: Colors.white, fontFamily: Fonts.bold, fontSize: FontSizes.md },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  bar: { width: 5 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sev: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  sevText: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.6 },
  ago: { fontSize: FontSizes.xs, color: Colors.textTertiary, fontFamily: Fonts.medium },
  title: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.navy, marginBottom: 4 },
  desc: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20, marginBottom: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillMint: { backgroundColor: Colors.tealBg },
  pillText: { fontSize: FontSizes.xs, fontFamily: Fonts.semibold, color: Colors.text },
  note: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginTop: 8, borderWidth: 1, borderColor: Colors.border },
  noteText: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 8 },
  emptySubtitle: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center' },
});
