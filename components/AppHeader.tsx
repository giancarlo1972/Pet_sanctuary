import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export default function AppHeader({ title, showBack = false, rightAction }: AppHeaderProps) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {showBack ? (
          <TouchableOpacity style={styles.sideBtn} onPress={() => router.back()} activeOpacity={0.75}>
            <ChevronLeft color={Colors.text} size={22} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.brand} onPress={() => router.push('/(tabs)')} activeOpacity={0.8}>
            <Image source={require('../assets/icon.png')} style={styles.logo} />
            <Text style={styles.brandName}>Rescue Army</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {rightAction ?? (
          <TouchableOpacity style={styles.meBtn} onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.85}>
            <Text style={styles.meText}>Me</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  sideBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 140 },
  logo: { width: 28, height: 28, borderRadius: 8 },
  brandName: { fontSize: FontSizes.md, fontFamily: Fonts.extrabold, color: Colors.navy },
  title: {
    flex: 1, fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.navy, textAlign: 'center',
  },
  meBtn: {
    backgroundColor: Colors.coral, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
  },
  meText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.white },
});
