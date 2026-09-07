import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key';

let actingHeaders: Record<string, string> = {};

export function setSupabaseActingHeaders(role?: string | null, org?: string | null) {
  const next: Record<string, string> = {};
  if (role) next['x-acting-role'] = role;
  if (org) next['x-acting-org'] = org;
  actingHeaders = next;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      Object.entries(actingHeaders).forEach(([k, v]) => headers.set(k, v));
      return fetch(input, { ...init, headers });
    },
  },
});
