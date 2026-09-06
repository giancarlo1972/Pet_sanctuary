import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '@/components/AppHeader';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { SUPPORT_EMAIL, supportMailto } from '@/lib/contact';

const ITEMS = [
  {
    kind: 'INCIDENT',
    title: 'Nepal Flood Tragedy 2026',
    body: 'Local partner intake. Rescue Army only opens their PayPal/Venmo — we never hold the money.',
  },
  {
    kind: 'NATIONAL',
    title: 'ASPCA, PETA, Humane World',
    body: 'Official donate pages are linked from Care Fund. Local humane societies register separately.',
  },
  {
    kind: 'APP',
    title: 'App support',
    body: SUPPORT_EMAIL + ' — bugs, reports, admin access. Not donations.',
  },
];

export default function UpdatesScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppHeader title="Updates" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        {ITEMS.map((a) => (
          <View key={a.title} style={styles.card}>
            <Text style={styles.kind}>{a.kind}</Text>
            <Text style={styles.title}>{a.title}</Text>
            <Text style={styles.body}>{a.body}</Text>
          </View>
        ))}
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
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14 },
  kind: { fontSize: 10, fontFamily: Fonts.extrabold, color: Colors.coral, letterSpacing: 0.8 },
  title: { marginTop: 6, fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.navy },
  body: { marginTop: 4, fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20 },
  mail: { borderWidth: 1, borderColor: Colors.border, borderRadius: 14, padding: 14, alignItems: 'center' },
  mailText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.navy },
});
