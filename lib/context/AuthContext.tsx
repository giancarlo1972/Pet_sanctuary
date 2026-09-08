import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { supabase, setSupabaseActingHeaders } from '@/lib/supabase';
import { isPlatformAdmin, homeRole } from '@/lib/admin-access';
import { loadActingAs, saveActingAs, actingLabel, type ActingAs, type ActingRole, type HeldRole } from '@/lib/acting-as';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  realRole: string | null;
  realPlatform: boolean;
  realOrgAdmin: boolean;
  realPetAdmin: boolean;
  orgs: { id: string; name: string }[];
  heldRoles: HeldRole[];
  actingAs: ActingAs | null;
  isActing: boolean;
  setActingAs: (next: ActingAs | null) => Promise<void>;
  clearActingAs: () => Promise<void>;
  actingIsPlatform: boolean;
  actingIsOrgAdmin: boolean;
  actingIsPetAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  realRole: null,
  realPlatform: false,
  realOrgAdmin: false,
  realPetAdmin: false,
  orgs: [],
  heldRoles: [],
  actingAs: null,
  isActing: false,
  setActingAs: async () => {},
  clearActingAs: async () => {},
  actingIsPlatform: false,
  actingIsOrgAdmin: false,
  actingIsPetAdmin: false,
});

function applyHeaders(next: ActingAs | null) {
  if (!next) setSupabaseActingHeaders(null, null);
  else setSupabaseActingHeaders(next.role, next.orgId || null);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [realRole, setRealRole] = useState<string | null>(null);
  const [realPlatform, setRealPlatform] = useState(false);
  const [realOrgAdmin, setRealOrgAdmin] = useState(false);
  const [realPetAdmin, setRealPetAdmin] = useState(false);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [heldRoles, setHeldRoles] = useState<HeldRole[]>([]);
  const [actingAs, setActingAsState] = useState<ActingAs | null>(null);

  const hydrateRoles = useCallback(async (uid: string, email?: string | null) => {
    const { data: profile } = await supabase.from('profiles').select('role, email').eq('id', uid).maybeSingle();
    const role = (profile?.role || '').toLowerCase();
    setRealRole(role || 'member');
    const platform = isPlatformAdmin(role, email || profile?.email);
    setRealPlatform(platform);

    const { data: mem } = await supabase.from('organization_members')
      .select('organization_id, role, organizations(id, name)').eq('user_id', uid).eq('role', 'admin');
    const mine = ((mem || []) as any[]).map((m) => ({ id: m.organizations?.id || m.organization_id, name: m.organizations?.name || 'Organization' })).filter((o) => o.id);
    let orgList = mine;
    if (platform) {
      const { data: all } = await supabase.from('organizations').select('id, name').order('name').limit(40);
      if (all?.length) orgList = all as any;
    }
    setOrgs(orgList);
    setRealOrgAdmin(mine.length > 0);

    const { count } = await supabase.from('pets').select('id', { count: 'exact', head: true }).eq('owner_id', uid);
    const petAdmin = (count || 0) > 0;
    setRealPetAdmin(petAdmin);

    const held: HeldRole[] = [];
    if (platform) held.push({ key: 'platform', role: 'platform_admin', label: 'Platform admin' });
    orgList.forEach((o) => held.push({ key: `org:${o.id}`, role: 'org_admin', orgId: o.id, orgName: o.name, label: `Org admin · ${o.name}` }));
    if (platform || petAdmin) held.push({ key: 'pet', role: 'pet_admin', label: 'Pet admin' });
    held.push({ key: 'member', role: 'member', label: 'Member' });
    setHeldRoles(held);

    const stored = await loadActingAs();
    const home = homeRole(platform, mine.length > 0, petAdmin);
    if (stored) {
      const allowed = platform || held.some((h) => h.role === stored.role && (!stored.orgId || h.orgId === stored.orgId));
      if (!allowed || (stored.role === home && (!stored.orgId || stored.orgId === mine[0]?.id))) {
        await saveActingAs(null);
        setActingAsState(null);
        applyHeaders(null);
      } else {
        setActingAsState(stored);
        applyHeaders(stored);
      }
    } else {
      applyHeaders(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      if (data.session?.user) hydrateRoles(data.session.user.id, data.session.user.email);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
      if (newSession?.user) hydrateRoles(newSession.user.id, newSession.user.email);
      else {
        setActingAsState(null);
        applyHeaders(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [hydrateRoles]);

  const setActingAs = useCallback(async (next: ActingAs | null) => {
    const home = homeRole(realPlatform, realOrgAdmin, realPetAdmin);
    const reduced = next && next.role !== home;
    const value = reduced ? next : null;
    await saveActingAs(value);
    setActingAsState(value);
    applyHeaders(value);
    if (user && value) {
      await supabase.from('audit_log').insert({
        actor_id: user.id,
        action: 'acting_as',
        acting_as: value.role,
        organization_id: value.orgId || null,
        detail: { orgName: value.orgName || null, real_role: realRole },
      });
    }
  }, [realPlatform, realOrgAdmin, realPetAdmin, user, realRole]);

  const clearActingAs = useCallback(async () => {
    await saveActingAs(null);
    setActingAsState(null);
    applyHeaders(null);
    if (user) {
      await supabase.from('audit_log').insert({
        actor_id: user.id,
        action: 'acting_as_exit',
        acting_as: 'self',
        detail: { real_role: realRole },
      });
    }
  }, [user, realRole]);

  const signOut = useCallback(async () => {
    await saveActingAs(null);
    setActingAsState(null);
    applyHeaders(null);
    await supabase.auth.signOut({ scope: 'local' });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        Object.keys(localStorage).forEach((k) => {
          if (k.startsWith('sb-') && k.includes('auth-token')) localStorage.removeItem(k);
        });
      } catch {}
      window.location.assign('/');
    }
  }, []);

  const isActing = Boolean(actingAs);
  const actingIsPlatform = actingAs ? actingAs.role === 'platform_admin' : realPlatform;
  const actingIsOrgAdmin = actingAs
    ? actingAs.role === 'org_admin' || actingAs.role === 'platform_admin'
    : realOrgAdmin || realPlatform;
  const actingIsPetAdmin = actingAs
    ? ['pet_admin', 'org_admin', 'platform_admin'].includes(actingAs.role)
    : realPetAdmin || realOrgAdmin || realPlatform;

  return (
    <AuthContext.Provider value={{
      user, session, loading, signOut,
      realRole, realPlatform, realOrgAdmin, realPetAdmin, orgs, heldRoles,
      actingAs, isActing, setActingAs, clearActingAs,
      actingIsPlatform, actingIsOrgAdmin, actingIsPetAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { actingLabel };
export type { ActingAs, ActingRole };
