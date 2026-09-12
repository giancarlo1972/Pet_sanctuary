import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { TriangleAlert as AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { useAuth } from '@/lib/context/AuthContext';
import SignInPrompt from '@/components/SignInPrompt';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import MyReportRow from '@/components/MyReportRow';
import { type MyReport, loadMyReports } from '@/lib/my-reports';

export default function ReportsTrackingScreen() {
  const { user, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); setReports([]); return; }
    try {
      setReports(await loadMyReports(user.id));
    } catch {
      setReports([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="My Reports" showBack />
      {!user ? (
        authLoading ? null : <SignInPrompt title="Sign in to see your reports" message="Reports you file, including anonymous ones matched to your verified phone, show up here." />
      ) : (
        <Page refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[Colors.coral]} />}>
          {loading ? (
            <ActivityIndicator size="large" color={Colors.coral} style={{ marginTop: 40 }} />
          ) : reports.length === 0 ? (
            <View style={styles.emptyState}>
              <AlertTriangle color={Colors.textTertiary} size={40} />
              <Text style={styles.emptyTitle}>No reports filed</Text>
              <Text style={styles.emptySubtitle}>Reports you file will be tracked here.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/report')} activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>File a Report</Text>
              </TouchableOpacity>
            </View>
          ) : (
            reports.map((r) => <MyReportRow key={r.id} report={r} />)
          )}
          {reports.length > 0 ? (
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/report')} activeOpacity={0.85}>
              <Text style={styles.emptyBtnText}>File a Report</Text>
            </TouchableOpacity>
          ) : null}
        </Page>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, marginTop: 12 },
  emptySubtitle: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 4, textAlign: 'center' },
  emptyBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.coral, alignItems: 'center' },
  emptyBtnText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.white },
});
