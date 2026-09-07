import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/lib/context/AuthContext';

function stripExpoRouterKey() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const u = new URL(window.location.href);
    let dirty = false;
    ['__EXPO_ROUTER_key', 'expo_router_key'].forEach((k) => {
      if (u.searchParams.has(k)) { u.searchParams.delete(k); dirty = true; }
    });
    if (u.hash && u.hash.includes('__EXPO_ROUTER')) {
      u.hash = '';
      dirty = true;
    }
    if (dirty) window.history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch {}
}

export default function RootLayout() {
  useFrameworkReady();
  useEffect(() => { stripExpoRouterKey(); }, []);

  return (
    <AuthProvider>
      <>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="admin" />
          <Stack.Screen name="pet-care" />
          <Stack.Screen name="updates" />
          <Stack.Screen name="invoices" />
          <Stack.Screen name="nearby-clinics" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="org-admin" />
        </Stack>
        <StatusBar style="auto" />
      </>
    </AuthProvider>
  );
}
