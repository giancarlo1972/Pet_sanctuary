import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { encodeGeohash } from '@/lib/geohash';
import { hoursLeft } from '@/lib/helper-duty';
import { normalizeCategories, type RoleCategory } from '@/lib/role-categories';
import {
  initialsFromName, loadMeView, saveMeView, type MeVisualRole,
} from '@/lib/me-chrome';

type MeChrome = {
  name: string;
  email: string | null;
  initials: string;
  avatarUrl: string | null;
  role: MeVisualRole;
  categories: RoleCategory[];
  onDuty: boolean;
  pending: number;
  setRole: (next: MeVisualRole) => Promise<void>;
  toggleDuty: () => Promise<{ ok: boolean; message?: string }>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<MeChrome>({
  name: '',
  email: null,
  initials: 'ME',
  avatarUrl: null,
  role: 'owner',
  categories: ['owner'],
  onDuty: false,
  pending: 0,
  setRole: async () => {},
  toggleDuty: async () => ({ ok: true }),
  refresh: async () => {},
});

async function currentGeohash(): Promise<string | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 60000 });
    });
    return encodeGeohash(pos.coords.latitude, pos.coords.longitude, 5);
  } catch {
    return null;
  }
}

async function countPendingFallback(uid: string, email: string | null) {
  const em = String(email || '').toLowerCase();
  const [xf, help, docs] = await Promise.all([
    supabase.from('pet_transfers').select('id', { count: 'exact', head: true }).eq('to_user', uid).eq('status', 'pending'),
    supabase.from('help_requests').select('id', { count: 'exact', head: true }).eq('helper_id', uid).eq('status', 'pending'),
    supabase.from('pets').select('id').eq('owner_id', uid),
  ]);
  let shares = 0;
  if (em) {
    const sh = await supabase.from('pet_share_invites').select('id', { count: 'exact', head: true }).eq('status', 'pending').ilike('invited_email', em);
    shares = sh.count || 0;
  }
  let docsN = 0;
  const petIds = (docs.data || []).map((p: any) => p.id);
  if (petIds.length) {
    const d = await supabase.from('pet_documents').select('id', { count: 'exact', head: true }).in('pet_id', petIds).in('ai_status', ['ready', 'partial', 'parsed']);
    docsN = d.count || 0;
  }
  return (xf.count || 0) + (help.count || 0) + shares + docsN;
}

export function MeChromeProvider({ children }: { children: React.ReactNode }) {
  const { user, realPlatform, orgs, setActingAs, clearActingAs, actingAs } = useAuth();
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<RoleCategory[]>(['owner']);
  const [role, setRoleState] = useState<MeVisualRole>(loadMeView);
  const [onDuty, setOnDuty] = useState(false);
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setName('');
      setAvatarUrl(null);
      setOnDuty(false);
      setPending(0);
      return;
    }
    const { data: row } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, role_categories')
      .eq('id', user.id)
      .maybeSingle();
    const p = row as any;
    setName(p?.full_name || '');
    setAvatarUrl(p?.avatar_url || null);
    const cats = normalizeCategories(p?.role_categories);
    setCategories(cats);

    const stored = loadMeView();
    const allowed: MeVisualRole[] = [
      ...cats.filter((c) => c !== 'campaign') as MeVisualRole[],
      ...(realPlatform ? ['platform' as const] : []),
    ];
    const nextRole = allowed.includes(stored) ? stored : (cats[0] === 'campaign' ? 'owner' : (cats[0] as MeVisualRole) || 'owner');
    setRoleState(nextRole);

    const { data: hs } = await supabase.from('helper_status').select('on_duty, until_at').eq('user_id', user.id).maybeSingle();
    const left = hoursLeft(hs?.until_at || null);
    setOnDuty(Boolean(hs?.on_duty) && left > 0);

    const rpc = await supabase.rpc('pending_actions');
    if (!rpc.error && typeof rpc.data === 'number') setPending(rpc.data);
    else setPending(await countPendingFallback(user.id, user.email || null));
  }, [user, realPlatform]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => { void refresh(); }, 60000);
    return () => clearInterval(t);
  }, [user, refresh]);

  const setRole = useCallback(async (next: MeVisualRole) => {
    saveMeView(next);
    setRoleState(next);
    if (next === 'platform') {
      await setActingAs({ role: 'platform_admin' });
      return;
    }
    if (next === 'organization' && orgs[0]) {
      await setActingAs({ role: 'org_admin', orgId: orgs[0].id, orgName: orgs[0].name });
      return;
    }
    if (actingAs) await clearActingAs();
  }, [setActingAs, clearActingAs, orgs, actingAs]);

  const toggleDuty = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    if (!user) return { ok: false, message: 'Sign in first.' };
    const { data: hs } = await supabase.from('helper_status').select('*').eq('user_id', user.id).maybeSingle();
    const left = hoursLeft(hs?.until_at || null);
    const currentlyOn = Boolean(hs?.on_duty) && left > 0;
    if (currentlyOn) {
      const { error } = await supabase.from('helper_status').update({ on_duty: false, until_at: null }).eq('user_id', user.id);
      if (error) return { ok: false, message: error.message };
      setOnDuty(false);
      return { ok: true };
    }
    const services = hs?.services || [];
    if (!services.length) return { ok: false, message: 'Pick a service on Me before going on duty.' };
    const geohash = await currentGeohash() || hs?.geohash || null;
    if (!geohash) return { ok: false, message: 'Location is needed to go on duty (approximate area only).' };
    const payload = {
      user_id: user.id,
      on_duty: true,
      services,
      radius_mi: hs?.radius_mi || 5,
      contact_prefs: hs?.contact_prefs?.length ? hs.contact_prefs : ['inapp'],
      geohash,
      until_at: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    };
    const { error } = await supabase.from('helper_status').upsert(payload);
    if (error) return { ok: false, message: error.message };
    setOnDuty(true);
    return { ok: true };
  }, [user]);

  const value = useMemo<MeChrome>(() => ({
    name,
    email: user?.email || null,
    initials: initialsFromName(name, user?.email),
    avatarUrl,
    role,
    categories,
    onDuty,
    pending,
    setRole,
    toggleDuty,
    refresh,
  }), [name, user?.email, avatarUrl, role, categories, onDuty, pending, setRole, toggleDuty, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMeChrome() {
  return useContext(Ctx);
}
