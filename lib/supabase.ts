import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://invalid.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(Platform.OS === 'web'
      ? { detectSessionInUrl: true }
      : {
          storage: AsyncStorage,
          detectSessionInUrl: false,
          flowType: 'pkce' as const,
        }),
    persistSession: true,
    autoRefreshToken: true,
  },
});
