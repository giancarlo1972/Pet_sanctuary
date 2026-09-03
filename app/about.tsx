import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, PawPrint, Heart, Shield, Users, Siren } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

const FEATURES = [
  { icon: Heart, title: 'Adopt & Foster', desc: 'Browse pets available for adoption and foster from verified organizations.' },
  { icon: Siren, title: 'Live Reports', desc: 'Report lost, stray, or injured animals and track alerts near you.' },
  { icon: Users, title: 'Community', desc: 'Connect with shelters, rescue groups, and other animal lovers.' },
  { icon: Shield, title: 'Verified Organizations', desc: 'All organizations are verified for your safety and trust.' },
];

export default function AboutScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBtn} onPress={() => router.back()} activeOpacity={0.75}>
          <ChevronLeft color={Colors.text} size={22} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>About</Text>
        <View style={styles.topBtn} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><PawPrint color={Colors.coral} size={40} /></View>
          <Text style={styles.heroTitle}>Rescue Army</Text>
          <Text style={styles.heroSubtitle}>A community-driven platform connecting pets, people, and organizations to save animal lives.</Text>
        </View>
        <View style={styles.featuresContainer}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <View key={i} style={styles.featureCard}>
                <View style={styles.featureIcon}><Icon color={Colors.coral} size={22} /></View>
                <View style={styles.featureInfo}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>
        <Text style={styles.missionTitle}>Our Mission</Text>
        <Text style={styles.missionText}>
          Every year, millions of animals enter shelters. Rescue Army was built to reduce that number by making it easy for anyone to report animals in need, find pets to adopt or foster, and support the organizations doing the hard work on the ground.
        </Text>
        <Text style={styles.missionText}>
          Whether you're an individual who spotted a stray on your commute, a foster volunteer opening your home, or a shelter managing hundreds of animals, Rescue Army gives you the tools to help.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.screen },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
  topBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center' },
  topTitle: { flex: 1, fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 60 },
  hero: { alignItems: 'center', marginBottom: 32 },
  heroIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.coralBg, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontSize: FontSizes['3xl'], fontFamily: Fonts.extrabold, color: Colors.text, marginBottom: 8 },
  heroSubtitle: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  featuresContainer: { gap: 12, marginBottom: 28 },
  featureCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: Colors.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border },
  featureIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.coralBg, justifyContent: 'center', alignItems: 'center' },
  featureInfo: { flex: 1 },
  featureTitle: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 4 },
  featureDesc: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 20 },
  missionTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 10 },
  missionText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textBody, lineHeight: 22, marginBottom: 12 },
});
