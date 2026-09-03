import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Home, PawPrint, Users, User } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

const TABS = [
  { href: '/(tabs)', label: 'Home', icon: Home },
  { href: '/(tabs)/pets', label: 'Pets', icon: PawPrint },
  { href: '/(tabs)/community', label: 'Community', icon: Users },
  { href: '/profile', label: 'Profile', icon: User },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.href === '/(tabs)' && pathname === '/') ||
          (tab.href === '/(tabs)/pets' && pathname === '/pets') ||
          (tab.href === '/(tabs)/community' && pathname === '/community');
        const Icon = tab.icon;
        return (
          <TouchableOpacity
            key={tab.href}
            style={styles.tab}
            onPress={() => router.push(tab.href as any)}
            activeOpacity={0.7}
          >
            <Icon color={active ? Colors.coral : Colors.textTertiary} size={22} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
});
