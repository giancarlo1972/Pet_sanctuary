import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';

export default function RootLayout() {
  useFrameworkReady();

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <Stack 
        screenOptions={{ headerShown: false }}
        initialRouteName="onboarding"
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="pet-details" />
        <Stack.Screen name="add-pet" />
        <Stack.Screen name="location-management" />
        <Stack.Screen name="upload-pet" />
        <Stack.Screen name="pet-management" />
        <Stack.Screen name="media-gallery" />
        <Stack.Screen name="lost-stray-report" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="chip-scanner" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="incident-report" />
        <Stack.Screen name="reports-search" />
        <Stack.Screen name="reports-tracking" />
        <Stack.Screen name="api-configuration" />
        <Stack.Screen name="organizations-list" />
        <Stack.Screen name="organization-details" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" backgroundColor="transparent" />
    </>
  );
}