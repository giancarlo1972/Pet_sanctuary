import { useRouter, useRouter as useExpoRouter } from 'expo-router';
import { useCallback } from 'react';

export function useSafeBack(fallback: string = '/(tabs)') {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback as any);
    }
  }, [router, fallback]);
}
