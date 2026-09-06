import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/lib/context/AuthContext';
import { createSessionFromUrl } from '@/lib/oauth';

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handleUrl = (url: string | null) => {
      if (!url) return;
      createSessionFromUrl(url).catch(() => {});
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  return (
    <AuthProvider>
      <>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style="auto" />
      </>
    </AuthProvider>
  );
}
