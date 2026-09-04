import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, User } from 'lucide-react-native';
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
          <TouchableOpacity style={styles.sideBtn} onPress={() => router.push('/(tabs)')} activeOpacity={0.75}>
            <Image source={require('@/assets/icon.png')} style={styles.logo} />
          </TouchableOpacity>
        )}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.rightAction}>
          {rightAction ?? (
            <TouchableOpacity style={styles.sideBtn} onPress={() => router.push('/profile')} activeOpacity={0.75}>
              <User color={Colors.text} size={22} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sideBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logo: { width: 32, height: 32, borderRadius: 16 },
  title: {
    flex: 1,
    fontSize: FontSizes.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  rightAction: { width: 40, alignItems: 'center' },
});
