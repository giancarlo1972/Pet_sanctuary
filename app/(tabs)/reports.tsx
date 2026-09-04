import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Plus, MapPin, Clock, TriangleAlert as AlertTriangle, Siren, HeartHandshake, Megaphone, Car, ShieldAlert } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';

const REPORT_TYPE_LABELS: Record<string, string> = {
  lost: 'Lost Pet', stray: 'Stray Pet', foster: 'Foster', support: 'Support',
  inform: 'Authority', emergency: 'Emergency', road_accident: 'Road Accident',
  injured: 'Injured', lost_found: 'Lost/Found', cruelty: 'Cruelty',
};

const REPORT_TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  lost: AlertTriangle, stray: AlertTriangle, foster: HeartHandshake, support: HeartHandshake,
  inform: Megaphone, emergency: Siren, road_accident: Car, injured: AlertTriangle,
  lost_found: AlertTriangle, cruelty: ShieldAlert,
};

const SEVERITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: Colors.criticalBg, color: Colors.critical, label: 'CRITICAL' },
  urgent: { bg: Colors.urgentBg, color: Colors.urgent, label: 'URGENT' },
  standard: { bg: Colors.standardBg, color: Colors.accentDark, label: 'STANDARD' },
};

const FILTERS = ['All', 'Active', 'Resolved'] as const;
type Filter = typeof FILTERS[number];

function timeAgo(dateString: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

interface ReportRow {
  id: string;
  report_type: string;
  severity: string | null;
  status: string;
  pet_name: string | null;
  location_address: string;
  created_at: string;
  description: string;
}

export default function ReportsTabScreen() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');

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

  const filtered = reports.filter((r) => {
    if (filter === 'Active') return r.status === 'active';
    if (filter === 'Resolved') return r.status === 'resolved';
    return true;
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Reports</Text>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/lost-stray-report')} activeOpacity={0.85}>
          <Plus color={Colors.white} size={22} />
        </TouchableOpacity>
      </View>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} style={[styles.filterPill, filter === f && styles.filterPillActive]} onPress={() => setFilter(f)} activeOpacity={0.75}>
            <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadReports(); }} colors={[Colors.coral]} />}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.coral} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <AlertTriangle color={Colors.textTertiary} size={40} />
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptySubtitle}>When reports are filed, they'll appear here.</Text>
          </View>
        ) : (
          filtered.map((r) => {
            const sev = r.severity || 'standard';
            const sevStyle = SEVERITY_STYLE[sev] || SEVERITY_STYLE.standard;
            const Icon = REPORT_TYPE_ICONS[r.report_type] || AlertTriangle;
            return (
              <TouchableOpacity key={r.id} style={styles.reportCard} onPress={() => router.push(`/report-details?id=${r.id}`)} activeOpacity={0.85}>
                <View style={[styles.reportIcon, { backgroundColor: sevStyle.bg }]}>
                  <Icon color={sevStyle.color} size={18} />
                </View>
                <View style={styles.reportInfo}>
                  <View style={styles.reportTopRow}>
                    <Text style={styles.reportType}>{REPORT_TYPE_LABELS[r.report_type] || r.report_type}</Text>
                    <View style={[styles.sevBadge, { backgroundColor: sevStyle.bg }]}>
                      <Text style={[styles.sevBadgeText, { color: sevStyle.color }]}>{sevStyle.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.reportLocation} numberOfLines={1}>{r.location_address}</Text>
                  <View style={styles.reportMetaRow}>
                    <Clock color={Colors.textTertiary} size={12} />
                    <Text style={styles.reportMeta}>{timeAgo(r.created_at)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSizes['2xl'], fontFamily: Fonts.extrabold, color: Colors.text },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.coral, justifyContent: 'center', alignItems: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.white },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.surface },
  filterPillActive: { backgroundColor: Colors.coral },
  filterPillText: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.textSecondary },
  filterPillTextActive: { color: Colors.white, fontFamily: Fonts.bold },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 8, paddingBottom: 100 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 4 },
  reportCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  reportIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  reportInfo: { flex: 1 },
  reportTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  reportType: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text },
  sevBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  sevBadgeText: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  reportLocation: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: 4 },
  reportMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reportMeta: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary },
});
