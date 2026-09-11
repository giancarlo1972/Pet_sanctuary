import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Image, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { isPlatformAdmin } from '@/lib/admin-access';
import { Page } from '@/components/Page';
import { consumeAuthNext, peekAuthNext } from '@/lib/share-invite';

function redirectTo() {
  const pending = peekAuthNext();
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (pending) return `${window.location.origin}${pending}`;
    return `${window.location.origin}/`;
  }
  if (pending) return `https://rescue-army.com${pending}`;
  return 'https://rescue-army.com/';
}

function friendly(raw: string) {
  const m = (raw || '').toLowerCase();
  if (m.includes('rate limit')) return 'Too many emails sent. Wait 30 minutes, then Sign in. Do not Sign up again.';
  if (m.includes('not confirmed')) return 'Email not confirmed. In Supabase Authentication → Users, open this email and Auto Confirm.';
  if (m.includes('invalid login')) return 'Wrong email or password. If this is a new Rescue Army mailbox, create it first under Authentication → Users (Auto Confirm).';
  if (m.includes('already') || m.includes('registered')) return 'That email already has an account. Use Sign in.';
  return raw || 'Sign in failed.';
}

async function afterLogin(email: string) {
  const { data: sess } = await supabase.auth.getUser();
  const user = sess.user;
  const loginEmail = (user?.email || email || '').toLowerCase();
  let role = '';
  let onboarded = true;
  if (user?.id) {
    const { data: profile } = await supabase.from('profiles').select('role, onboarding_done').eq('id', user.id).maybeSingle();
    role = profile?.role || '';
    if (profile && profile.onboarding_done === false) onboarded = false;
  }
  const dest = consumeAuthNext() || (onboarded ? '/' : '/onboarding');
  const label = isPlatformAdmin(role, loginEmail) ? 'Rescue Army admin' : 'Member';
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { sessionStorage.setItem('ra_login_toast', label); } catch {}
    window.location.assign(dest);
    return;
  }
  router.replace(dest === '/' ? '/(tabs)' : dest as any);
}

export default function AuthScreen() {
  const dim = useWindowDimensions();
  const browserW = Platform.OS === 'web' && typeof window !== 'undefined' ? window.innerWidth : dim.width;
  const wide = browserW >= 768;
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resumeHint = Platform.OS === 'web' ? peekAuthNext() : null;

  useEffect(() => { peekAuthNext(); }, []);

  const submitEmail = async () => {
    const em = email.trim();
    if (!em || !password) { setError('Enter email and password.'); return; }
    setLoading(true); setError(null);
    try {
      if (mode === 'signin') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: em, password });
        if (e) throw e;
      } else {
        const { error: e } = await supabase.auth.signUp({ email: em, password });
        if (e) {
          const msg = (e.message || '').toLowerCase();
          if (msg.includes('already') || msg.includes('registered')) {
            const { error: s } = await supabase.auth.signInWithPassword({ email: em, password });
            if (s) throw s;
          } else throw e;
        }
      }
      await afterLogin(em);
    } catch (err: any) {
      setError(friendly(err.message));
    } finally {
      setLoading(false);
    }
  };

  const oauth = async (provider: 'google' | 'twitter') => {
    setLoading(true); setError(null);
    try {
      const { error: e } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectTo() },
      });
      if (e) throw e;
    } catch (err: any) {
      setError(friendly(err.message));
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrap}>
      <View style={[styles.split, wide && styles.splitWide]}>
        {wide && (
          <View style={styles.brandPanel}>
            <Image source={require('../assets/icon.png')} style={styles.brandLogo} />
            <Text style={styles.brandTitle}>Rescue Army</Text>
            <Text style={styles.brandSub}>Helping animals get rescued faster</Text>
            <Text style={styles.brandFoot}>Report · Adopt · Foster · Donate</Text>
          </View>
        )}
      <Page wideMax={720}>
      <View>
        {!wide && (
        <View style={styles.brandRow}>
          <Image source={require('../assets/icon.png')} style={styles.logo} />
          <View>
            <Text style={styles.brandKicker}>Rescue Army</Text>
            <Text style={styles.h1}>Sign in</Text>
          </View>
        </View>
        )}
        {wide && <Text style={styles.h1}>Sign in</Text>}
        <Text style={styles.lead}>
          {resumeHint?.includes('share-accept')
            ? 'Sign in to accept the pet invite. You’ll return to the Accept screen.'
            : <>The first person to sign in becomes <Text style={styles.leadEm}>Administrator</Text> and can approve orgs, IDs, and reports.</>}
        </Text>

        {error ? <Text style={styles.err}>{error}</Text> : null}

        <TouchableOpacity style={styles.oauth} onPress={() => oauth('google')} disabled={loading} activeOpacity={0.85}>
          <Text style={styles.oauthTxt}>Continue with Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.oauth} onPress={() => oauth('twitter')} disabled={loading} activeOpacity={0.85}>
          <Text style={styles.oauthTxt}>Continue with X</Text>
        </TouchableOpacity>

        <View style={styles.rule} />

        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={Colors.textTertiary} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={Colors.textTertiary} secureTextEntry onSubmitEditing={submitEmail} />

        <TouchableOpacity style={[styles.primary, loading && { opacity: 0.6 }]} onPress={submitEmail} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color={Colors.white} /> : (
            <Text style={styles.primaryTxt}>{mode === 'signin' ? 'Sign in with email' : 'Sign up with email'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }} activeOpacity={0.7}>
          <Text style={styles.switch}>
            {mode === 'signin' ? 'Need an account? ' : 'Already have an account? '}
            <Text style={styles.switchEm}>{mode === 'signin' ? 'Sign up' : 'Sign in'}</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(tabs)')} activeOpacity={0.7}>
          <Text style={styles.home}>Back to Home</Text>
        </TouchableOpacity>
      </View>
      </Page>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.white },
  split: { flex: 1 },
  splitWide: { flexDirection: 'row' },
  brandPanel: { flex: 1, backgroundColor: Colors.navy, justifyContent: 'center', paddingHorizontal: 64 },
  brandLogo: { width: 72, height: 72, borderRadius: 20, marginBottom: 24 },
  brandTitle: { fontSize: 40, fontFamily: Fonts.extrabold, color: Colors.white },
  brandSub: { fontSize: 20, fontFamily: Fonts.medium, color: '#B9BCE0', marginTop: 8 },
  brandFoot: { fontSize: 14, fontFamily: Fonts.semibold, color: '#8A8FBF', marginTop: 40 },
  inner: { paddingHorizontal: 24, paddingTop: 36, paddingBottom: 48, maxWidth: 480, width: '100%', alignSelf: 'center' },
  innerWide: { justifyContent: 'center', flexGrow: 1, paddingTop: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  logo: { width: 48, height: 48, borderRadius: 14 },
  brandKicker: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.navy },
  h1: { fontSize: 28, fontFamily: Fonts.extrabold, color: Colors.navy },
  lead: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, lineHeight: 22, marginBottom: 20 },
  leadEm: { fontFamily: Fonts.bold, color: Colors.navy },
  err: { color: Colors.critical, fontFamily: Fonts.medium, fontSize: FontSizes.sm, marginBottom: 12 },
  oauth: {
    borderWidth: 1.5, borderColor: Colors.navy, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  oauthTxt: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.navy },
  rule: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },
  input: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.white, marginBottom: 10,
  },
  primary: { backgroundColor: Colors.coral, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  primaryTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: FontSizes.md },
  switch: { textAlign: 'center', marginTop: 16, color: Colors.coral, fontFamily: Fonts.semibold, fontSize: FontSizes.md },
  switchEm: { fontFamily: Fonts.bold, color: Colors.coral },
  home: { textAlign: 'center', marginTop: 18, color: Colors.textSecondary, fontFamily: Fonts.semibold, fontSize: FontSizes.md },
});
