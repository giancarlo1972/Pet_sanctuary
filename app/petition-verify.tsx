import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/AppHeader';
import { Page } from '@/components/Page';

export default function PetitionVerify() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [state, setState] = useState<'working' | 'ok' | 'err'>('working');
  const [message, setMessage] = useState('Confirming your signature…');
  const [campaignId, setCampaignId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setState('err'); setMessage('Missing confirmation link.'); return; }
      const { data, error } = await supabase.rpc('verify_petition_signature', { p_token: token });
      if (error) { setState('err'); setMessage(error.message || 'This link is invalid or already used.'); return; }
      setCampaignId((data as any)?.campaign_id || null);
      setState('ok');
      setMessage('Signature confirmed. Thank you.');
    })();
  }, [token]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.screen }} edges={['top']}>
      <AppHeader title="Confirm signature" showBack />
      <Page>
        {state === 'working' ? <ActivityIndicator color={Colors.coral} /> : (
          <View style={s.box}>
            <Text style={s.txt}>{message}</Text>
            {campaignId ? (
              <TouchableOpacity style={s.btn} onPress={() => router.replace(`/campaign-details?id=${campaignId}`)}>
                <Text style={s.btnTxt}>Back to petition</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </Page>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  box: { marginTop: 24, gap: 16 },
  txt: { fontFamily: Fonts.semibold, fontSize: 16, color: Colors.navy, lineHeight: 22 },
  btn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnTxt: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.white },
});
