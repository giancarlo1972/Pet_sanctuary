import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { SHARE_LEVELS } from '@/lib/admin-access';
import { rememberShareToken, readShareToken, clearShareToken } from '@/lib/share-invite';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';

type Peek = {
  ok?: boolean;
  error?: string;
  status?: string;
  pet_id?: string;
  pet_name?: string;
  pet_photo?: string | null;
  level?: string;
};

function oneParam(v?: string | string[]) {
  if (Array.isArray(v)) return v[0] || '';
  return v || '';
}

function levelLabel(level?: string) {
  const hit = SHARE_LEVELS.find((l) => l.key === level);
  if (hit) return hit.label;
  if (!level) return 'shared access';
  return level.replace(/_/g, ' ');
}

export default function ShareAcceptScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => {
    const fromRoute = oneParam(params.token);
    if (fromRoute) return fromRoute;
    return readShareToken() || '';
  }, [params.token]);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [peek, setPeek] = useState<Peek | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (token) rememberShareToken(token);
  }, [token]);

  const loadPeek = useCallback(async () => {
    if (!token) {
      setErr('This invite link is missing a token.');
      return;
    }
    setErr(null);
    const { data, error } = await supabase.rpc('peek_pet_share', { tok: token });
    const payload = (data || {}) as Peek;
    if (error) {
      const m = (error.message || '').toLowerCase();
      if (m.includes('peek_pet_share') || m.includes('schema cache') || m.includes('does not exist')) {
        setPeek({ ok: true });
        return;
      }
      setErr(error.message);
      return;
    }
    if (!payload?.ok) {
      const code = payload?.error || payload?.status || 'invalid_or_expired';
      if (code === 'accepted') setErr('This invite was already accepted.');
      else if (code === 'revoked' || code === 'expired') setErr('This invite is no longer valid.');
      else setErr('Invite is invalid or expired.');
      setPeek(payload);
      return;
    }
    setPeek(payload);
  }, [token]);

  useEffect(() => {
    if (loading) return;
    void loadPeek();
  }, [loading, loadPeek]);

  const goSignIn = () => {
    if (token) rememberShareToken(token);
    const next = `/share-accept?token=${encodeURIComponent(token)}`;
    router.replace(`/auth?next=${encodeURIComponent(next)}`);
  };

  const accept = async () => {
    if (!token) return;
    if (!user) {
      goSignIn();
      return;
    }
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase.rpc('accept_pet_share', { tok: token });
    const payload = (data || {}) as { ok?: boolean; error?: string; pet_id?: string };
    setBusy(false);
    if (error || !payload?.ok) {
      const msg = error?.message || payload?.error || 'Could not accept invite.';
      if (msg === 'sign_in_required') {
        goSignIn();
        return;
      }
      setErr(msg === 'invalid_or_expired' ? 'Invite is invalid or expired.' : msg);
      return;
    }
    clearShareToken();
    router.replace(`/pet-record?petId=${payload.pet_id}`);
  };

  const title = peek?.pet_name ? `Join ${peek.pet_name}` : 'Pet invite';
  const role = levelLabel(peek?.level);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
      <AppHeader title="Pet invite" showBack />
      <Page>
        <View style={styles.card}>
          {peek?.pet_photo ? (
            <Image source={{ uri: peek.pet_photo }} style={styles.photo} />
          ) : (
            <View style={styles.photoPh} />
          )}
          <Text style={styles.title}>{title}</Text>
          {peek?.ok ? (
            <Text style={styles.body}>
              You’ve been invited as <Text style={styles.em}>{role}</Text>. Accept to add this pet to your account. Nothing is shared until you accept.
            </Text>
          ) : err ? (
            <Text style={styles.err}>{err}</Text>
          ) : (
            <>
              <ActivityIndicator color={Colors.coral} />
              <Text style={styles.body}>Opening invite…</Text>
            </>
          )}
          {peek?.ok && err ? <Text style={styles.err}>{err}</Text> : null}

          {peek?.ok ? (
            user ? (
              <TouchableOpacity style={[styles.primary, busy && { opacity: 0.6 }]} onPress={accept} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryT}>Accept</Text>}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.primary} onPress={goSignIn} activeOpacity={0.85}>
                <Text style={styles.primaryT}>Sign in to accept</Text>
              </TouchableOpacity>
            )
          ) : null}

          <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} activeOpacity={0.7}>
            <Text style={styles.link}>Back to Me</Text>
          </TouchableOpacity>
        </View>
      </Page>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, gap: 12, alignItems: 'center' },
  photo: { width: 96, height: 96, borderRadius: 16, backgroundColor: Colors.surface },
  photoPh: { width: 96, height: 96, borderRadius: 16, backgroundColor: Colors.surface },
  title: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.navy, textAlign: 'center' },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  em: { fontFamily: Fonts.bold, color: Colors.navy },
  err: { fontFamily: Fonts.medium, color: Colors.critical, textAlign: 'center' },
  primary: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center', alignSelf: 'stretch' },
  primaryT: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 15 },
  link: { fontFamily: Fonts.bold, color: Colors.coral, marginTop: 4 },
});
