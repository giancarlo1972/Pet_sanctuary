import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { isPlatformAdmin } from '@/lib/admin-access';

interface AuthFormProps {
  variant?: 'plain' | 'modal';
}

function redirectAfterLogin() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/admin`;
  }
  return 'https://rescue-army.com/admin';
}

function friendlyError(raw: string) {
  const m = (raw || '').toLowerCase();
  if (m.includes('rate limit')) return 'Too many signup emails. Wait 30 minutes, then Sign In — do not Sign Up. Or use Continue with Google.';
  if (m.includes('not confirmed')) return 'This email is not confirmed yet. In Supabase: Authentication → Users → that email → Confirm. Or use Google.';
  if (m.includes('invalid login')) return 'Wrong email or password. If you just created this Microsoft mailbox, the app user may not exist yet — use Google (the Gmail that already worked).';
  if (m.includes('already') || m.includes('registered')) return 'That email is already registered. Use Sign In or Google.';
  return raw || 'Sign in failed.';
}

export default function AuthForm(_props: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (loginEmail: string) => {
    const { data: sess } = await supabase.auth.getUser();
    let role = '';
    if (sess.user?.id) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', sess.user.id).maybeSingle();
      role = profile?.role || '';
    }
    const dest = isPlatformAdmin(role, sess.user?.email || loginEmail) ? '/admin' : '/(tabs)';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign(dest.replace('/(tabs)', '/'));
      return;
    }
    router.replace(dest);
  };

  const handleSubmit = async () => {
    const em = email.trim();
    const pw = password;
    if (!em || !pw) {
      setError('Enter email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: em, password: pw });
      if (signErr) throw signErr;
      await finish(em);
    } catch (err: any) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: gErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectAfterLogin() },
      });
      if (gErr) throw gErr;
    } catch (err: any) {
      setError(friendlyError(err.message));
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={Colors.textTertiary}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={Colors.textTertiary}
        secureTextEntry
        autoComplete="password"
        onSubmitEditing={handleSubmit}
      />
      <TouchableOpacity style={[styles.submitBtn, loading && styles.btnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
        {loading ? <ActivityIndicator color={Colors.white} size="small" /> : (
          <Text style={styles.submitText}>Sign In</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.googleBtn} onPress={handleGoogle} disabled={loading} activeOpacity={0.85}>
        <Text style={styles.googleText}>Continue with Google</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: Colors.borderInput,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.text,
    backgroundColor: Colors.white,
  },
  submitBtn: {
    backgroundColor: Colors.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  btnDisabled: { opacity: 0.6 },
  errorBox: {
    backgroundColor: Colors.criticalBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.critical,
  },
  googleBtn: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  googleText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
});
