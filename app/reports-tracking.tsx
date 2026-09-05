import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, TriangleAlert as AlertTriangle, Clock, MapPin, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';

const REPORT_TYPE_LABELS: Record<string, string> = {
  lost: 'Lost Pet', stray: 'Stray Pet', foster: 'Foster', support: 'Support',
  inform: 'Authority', emergency: 'Emergency', road_accident: 'Road Accident',
  injured: 'Injured', lost_found: 'Lost/Found', cruelty: 'Cruelty',
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: Colors.coralBg, color: Colors.coral, label: 'Active' },
  resolved: { bg: Colors.tealBg, color: Colors.teal, label: 'Resolved' },
  closed: { bg: Colors.surface, color: Colors.textSecondary, label: 'Closed' },
};

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
  status: string;
  pet_name: string | null;
  location_address: string;
  created_at: string;
  severity: string | null;
}

export default function ReportsTrackingScreen() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('id, report_type, status, pet_name, location_address, created_at, severity')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) setReports(data);
    } catch { /* ignore */ }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>My Reports</Text>
        <View style={styles.topBtn} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.coral]} />}>
        {loading ? (
          <ActivityIndicator size="large" color={Colors.coral} style={{ marginTop: 40 }} />
        ) : reports.length === 0 ? (
          <View style={styles.emptyState}>
            <AlertTriangle color={Colors.textTertiary} size={40} />
            <Text style={styles.emptyTitle}>No reports filed</Text>
            <Text style={styles.emptySubtitle}>Reports you file will be tracked here.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/lost-stray-report')} activeOpacity={0.85}>
              <Text style={styles.emptyBtnText}>File a Report</Text>
            </TouchableOpacity>
          </View>
        ) : (
          reports.map((r) => {
            const statusStyle = STATUS_STYLE[r.status] || STATUS_STYLE.active;
            return (
              <TouchableOpacity key={r.id} style={styles.reportCard} onPress={() => router.push(`/report-details?id=${r.id}`)} activeOpacity={0.85}>
                <View style={styles.reportInfo}>
                  <View style={styles.reportTopRow}>
                    <Text style={styles.reportType}>{REPORT_TYPE_LABELS[r.report_type] || r.report_type}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>{statusStyle.label}</Text>
                    </View>
                  </View>
                  {r.pet_name && <Text style={styles.reportPetName}>{r.pet_name}</Text>}
                  <Text style={styles.reportLocation} numberOfLines={1}>{r.location_address}</Text>
                  <View style={styles.reportMetaRow}>
                    <Clock color={Colors.textTertiary} size={12} />
                    <Text style={styles.reportMeta}>{timeAgo(r.created_at)}</Text>
                  </View>
                </View>
                <ChevronRight color={Colors.textTertiary} size={18} />
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
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topTitle: { flex: 1, fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 60 },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 4 },
  emptyBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.coral },
  emptyBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
  reportCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  reportInfo: { flex: 1 },
  reportTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  reportType: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  reportPetName: { fontSize: FontSizes.sm, fontFamily: Fonts.medium, color: Colors.textBody, marginBottom: 2 },
  reportLocation: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginBottom: 4 },
  reportMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reportMeta: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary },
});
