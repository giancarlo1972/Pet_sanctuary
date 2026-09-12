import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import {
  type MyReport,
  reportStatusStyle,
  reportSeverityStyle,
  reportTitle,
  reportTimeAgo,
  outcomeLabel,
} from '@/lib/my-reports';

export default function MyReportRow({ report }: { report: MyReport }) {
  const sev = reportSeverityStyle(report.severity);
  const st = reportStatusStyle(report.status);
  const matches = report.match_count && report.match_count > 0
    ? `${report.match_count} match${report.match_count === 1 ? '' : 'es'}`
    : null;
  const note = (report.status === 'rejected' || report.status === 'dismissed')
    ? report.moderator_note
    : report.status === 'resolved'
      ? outcomeLabel(report.resolution_outcome)
      : report.status === 'cancelled' || report.status === 'closed'
        ? report.cancel_reason
        : null;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/report-details?id=${report.id}`)}
      activeOpacity={0.85}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.top}>
          <View style={[styles.pill, { backgroundColor: sev.bg }]}>
            <Text style={[styles.pillTxt, { color: sev.color }]}>{sev.label}</Text>
          </View>
          <Text style={styles.time}>{reportTimeAgo(report.created_at)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{reportTitle(report)}</Text>
        <View style={styles.meta}>
          <View style={[styles.pill, { backgroundColor: st.bg }]}>
            <Text style={[styles.pillTxt, { color: st.color }]}>{st.label}</Text>
          </View>
          {matches ? (
            <View style={[styles.pill, { backgroundColor: Colors.surface }]}>
              <Text style={[styles.pillTxt, { color: Colors.navy }]}>{matches}</Text>
            </View>
          ) : null}
        </View>
        {note ? <Text style={styles.note} numberOfLines={2}>{note}</Text> : null}
      </View>
      <ChevronRight color={Colors.textTertiary} size={16} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.white, borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 8,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy },
  time: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textTertiary },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillTxt: { fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 0.3 },
  note: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});
