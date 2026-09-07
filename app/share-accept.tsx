import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';

export default function ShareAcceptScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [msg, setMsg] = useState('Opening invite…');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!token) { setErr('This invite link is missing a token.'); return; }
    if (!user) {
      router.replace(`/auth?next=${encodeURIComponent(`/share-accept?token=${token}`)}`);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc('accept_pet_share', { tok: token });
      const payload = data as { ok?: boolean; error?: string; pet_id?: string } | null;
      if (error || !payload?.ok) {
        setErr(error?.message || payload?.error || 'Invite is invalid or expired.');
        return;
      }
      setMsg('You’re in.');
      router.replace(`/pet-record?petId=${payload.pet_id}`);
    })();
  }, [loading, user, token]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
      <AppHeader title="Pet invite" showBack />
      <Page>
        <View style={styles.card}>
          {err ? <Text style={styles.err}>{err}</Text> : (
            <>
              <ActivityIndicator color={Colors.coral} />
              <Text style={styles.body}>{msg}</Text>
            </>
          )}
          <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')}>
            <Text style={styles.link}>Back to Me</Text>
          </TouchableOpacity>
        </View>
      </Page>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, gap: 12, alignItems: 'center' },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.md, color: Colors.textSecondary, textAlign: 'center' },
  err: { fontFamily: Fonts.medium, color: Colors.critical, textAlign: 'center' },
  link: { fontFamily: Fonts.bold, color: Colors.coral, marginTop: 8 },
});
