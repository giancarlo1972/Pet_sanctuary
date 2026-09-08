import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '@/components/AppHeader';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/contact';

export default function UpdatesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Updates" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No updates yet</Text>
          <Text style={styles.emptyBody}>
            Care Fund incidents, nearby reports, and account notices will show up here.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.kind}>APP</Text>
          <Text style={styles.title}>App support</Text>
          <Text style={styles.body}>{SUPPORT_EMAIL} — bugs, reports, admin access. Not donations.</Text>
        </View>
        <TouchableOpacity
          style={styles.mail}
          onPress={() => Linking.openURL(supportMailto('Rescue Army app — issue / report / admin access'))}
        >
          <Text style={styles.mailText}>App support · {SUPPORT_EMAIL}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  empty: { backgroundColor: Colors.white, borderRadius: 16, padding: 20 },
  emptyTitle: { fontFamily: Fonts.extrabold, fontSize: FontSizes.md, color: Colors.navy },
  emptyBody: { marginTop: 6, fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  kind: { fontSize: 10, fontFamily: Fonts.extrabold, color: Colors.coral, letterSpacing: 0.8 },
  title: { marginTop: 6, fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.navy },
  body: { marginTop: 4, fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20 },
  mail: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, alignItems: 'center' },
  mailText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.navy },
});
