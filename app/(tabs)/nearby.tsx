import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

export default function NearbyScreen() {
  return (
    <View style={styles.screen}>
      <AppHeader title="Nearby" />
      <Page>
        <View style={styles.card}>
          <Text style={styles.kicker}>NEARBY</Text>
          <Text style={styles.title}>Reports, pets, and clinics around you</Text>
          <Text style={styles.body}>The map lands in the next update.</Text>
        </View>
      </Page>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.screen },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.navy,
    padding: 20,
    gap: 8,
  },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 11, letterSpacing: 0.8, color: Colors.textTertiary },
  title: { fontFamily: Fonts.bold, fontSize: FontSizes.lg, color: Colors.navy },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
});
