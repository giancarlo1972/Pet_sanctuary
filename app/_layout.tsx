import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/lib/context/AuthContext';

export default function RootLayout() {
  useFrameworkReady();

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
