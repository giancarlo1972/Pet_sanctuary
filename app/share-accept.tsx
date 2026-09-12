import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { SHARE_LEVELS } from '@/lib/admin-access';
import {
  rememberShareToken, readShareToken, clearShareToken,
  rememberTransferToken, readTransferToken, clearTransferToken,
} from '@/lib/share-invite';
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
  kind?: string;
  note?: string;
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
  const params = useLocalSearchParams<{ token?: string | string[]; kind?: string | string[] }>();
  const kindParam = oneParam(params.kind);
  const token = useMemo(() => {
    const fromRoute = oneParam(params.token);
    if (fromRoute) return fromRoute;
    if (kindParam === 'transfer') return readTransferToken() || '';
    return readShareToken() || readTransferToken() || '';
  }, [params.token, kindParam]);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [peek, setPeek] = useState<Peek | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isTransfer = kindParam === 'transfer' || peek?.kind === 'transfer';

  useEffect(() => {
    if (!token) return;
    if (kindParam === 'transfer') rememberTransferToken(token);
    else rememberShareToken(token);
  }, [token, kindParam]);

  const loadPeek = useCallback(async () => {
    if (!token) {
      setErr('This invite link is missing a token.');
      return;
    }
    setErr(null);
    const tryTransfer = kindParam === 'transfer';
    const rpcName = tryTransfer ? 'peek_pet_transfer' : 'peek_pet_share';
    const first = await supabase.rpc(rpcName, { tok: token });
    let payload = (first.data || {}) as Peek;
    if ((!payload?.ok && tryTransfer === false) || first.error) {
      const second = await supabase.rpc('peek_pet_transfer', { tok: token });
      if (second.data && (second.data as Peek).ok) payload = second.data as Peek;
      else if (!first.error && payload) { /* keep */ }
      else if (first.error) {
        const m = (first.error.message || '').toLowerCase();
        if (m.includes('schema cache') || m.includes('does not exist')) {
          setPeek({ ok: true });
          return;
        }
        if (!second.data) {
          setErr(first.error.message);
          return;
        }
      }
    }
    if (!payload?.ok) {
      const code = payload?.error || payload?.status || 'invalid_or_expired';
      if (code === 'accepted') setErr('This invite was already accepted.');
      else if (code === 'revoked' || code === 'expired' || code === 'cancelled' || code === 'declined') setErr('This invite is no longer valid.');
      else setErr('Invite is invalid or expired.');
      setPeek(payload);
      return;
    }
    setPeek(payload);
  }, [token, kindParam]);

  useEffect(() => {
    if (loading) return;
    void loadPeek();
  }, [loading, loadPeek]);

  const goSignIn = () => {
    if (token) {
      if (isTransfer) rememberTransferToken(token);
      else rememberShareToken(token);
    }
    const next = isTransfer
      ? `/share-accept?token=${encodeURIComponent(token)}&kind=transfer`
      : `/share-accept?token=${encodeURIComponent(token)}`;
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
    const rpc = isTransfer ? 'accept_pet_transfer' : 'accept_pet_share';
    const { data, error } = await supabase.rpc(rpc, { tok: token });
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
    clearTransferToken();
    router.replace(`/pet-record?petId=${payload.pet_id}`);
  };

  const title = peek?.pet_name
    ? (isTransfer ? `Take ownership of ${peek.pet_name}` : `Join ${peek.pet_name}`)
    : (isTransfer ? 'Ownership transfer' : 'Pet invite');
  const role = isTransfer ? 'new owner' : levelLabel(peek?.level);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
      <AppHeader title={isTransfer ? 'Transfer' : 'Pet invite'} showBack />
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
              {isTransfer
                ? <>You will become the owner of this pet. The previous owner keeps read access for 30 days. Co-owners, caretakers, and vets stay on the record.</>
                : <>You’ve been invited as <Text style={styles.em}>{role}</Text>. Accept to add this pet to your account. Nothing is shared until you accept.</>}
            </Text>
          ) : err ? (
            <Text style={styles.err}>{err}</Text>
          ) : (
            <>
              <ActivityIndicator color={Colors.coral} />
              <Text style={styles.body}>Opening invite…</Text>
            </>
          )}
          {peek?.note ? <Text style={styles.body}>{peek.note}</Text> : null}
          {peek?.ok && err ? <Text style={styles.err}>{err}</Text> : null}

          {peek?.ok ? (
            user ? (
              <TouchableOpacity style={[styles.primary, busy && { opacity: 0.6 }]} onPress={accept} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryT}>{isTransfer ? 'Accept ownership' : 'Accept'}</Text>}
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
