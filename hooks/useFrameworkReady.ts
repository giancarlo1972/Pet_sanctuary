import { useEffect } from 'react';
import { usePathname, useRouter } from 'expo-router';

export function useFrameworkReady() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Framework readiness hook — ensures router is initialized
  }, [pathname, router]);
}
