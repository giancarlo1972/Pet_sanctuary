import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View, StyleSheet } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/lib/context/AuthContext';

function PhoneShell({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return children as any;
  return (
    <View style={shell.page}>
      <View style={shell.phone}>{children}</View>
    </View>
  );
}

const shell = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0E1230', alignItems: 'center' },
  phone: {
    flex: 1, width: '100%', maxWidth: 430, backgroundColor: '#F5F6FA',
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
  },
});

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <PhoneShell>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="pet-care" />
          <Stack.Screen name="updates" />
          <Stack.Screen name="invoices" />
          <Stack.Screen name="nearby-clinics" />
          <Stack.Screen name="auth" />
        </Stack>
        <StatusBar style="auto" />
      </PhoneShell>
    </AuthProvider>
  );
}
