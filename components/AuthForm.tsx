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

export default function AuthForm({ variant = 'plain' }: AuthFormProps) {
  const router = useRouter();
  const [mode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const goAfterAuth = async (fallbackEmail: string) => {
    const { data: sess } = await supabase.auth.getUser();
    const loginEmail = sess.user?.email || fallbackEmail;
    let role = '';
    if (sess.user?.id) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', sess.user.id).maybeSingle();
      role = profile?.role || '';
    }
    if (!sess.user) {
      setInfo('Account saved. Tap Sign In.');
      setMode('signin');
      return;
    }
    router.replace(isPlatformAdmin(role, loginEmail) ? '/admin' : '/(tabs)');
  };

  const handleSubmit = async () => {
    const em = email.trim();
    const pw = password;
    if (!em || !pw) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const attemptSignIn = async () => {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email: em, password: pw });
        if (signErr) throw signErr;
        await goAfterAuth(em);
      };

      if (mode === 'signin') {
        await attemptSignIn();
        return;
      }

      const { error: upErr } = await supabase.auth.signUp({ email: em, password: pw });
      if (upErr) {
        const msg = (upErr.message || '').toLowerCase();
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          await attemptSignIn();
          return;
        }
        throw upErr;
      }
      await goAfterAuth(em);
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
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
      setError(err.message || 'Google sign-in failed.');
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
      {info ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{info}</Text>
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
          <Text style={styles.submitText}>{mode === 'signin' ? 'Sign In' : 'Sign Up'}</Text>
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
  infoBox: {
    backgroundColor: Colors.tealBg || '#E6F4F1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  infoText: {
    fontSize: FontSizes.sm,
    fontFamily: Fonts.medium,
    color: Colors.tealDark || Colors.navy,
  },
  switchRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    fontSize: FontSizes.md,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  switchLink: {
    fontFamily: Fonts.bold,
    color: Colors.coral,
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
