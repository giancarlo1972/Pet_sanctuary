import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { encodeGeohash, decodeGeohash, geohashNeighbors, haversineMi } from '@/lib/geohash';
import { serviceLabel } from '@/lib/helper-duty';

type Helper = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  services: string[];
  radius_mi: number;
  geohash: string;
  until_at: string | null;
  miles: number;
};

async function myGeohash() {
  try {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 60000 });
    });
    return { hash: encodeGeohash(pos.coords.latitude, pos.coords.longitude, 5), lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export default function HelpersNearby({ userId }: { userId: string | null }) {
  const [rows, setRows] = useState<Helper[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const me = await myGeohash();
    if (!me) return;
    const hashes = geohashNeighbors(me.hash);
    const { data } = await supabase.rpc('helpers_on_duty_near', { p_hashes: hashes });
    const mapped: Helper[] = ((data || []) as any[]).map((h) => {
      const c = decodeGeohash(h.geohash);
      const miles = haversineMi(me, c);
      return { ...h, miles };
    }).filter((h) => h.miles <= (h.radius_mi || 5) + 2)
      .sort((a, b) => a.miles - b.miles)
      .slice(0, 12);
    setRows(mapped);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const requestHelp = async (h: Helper) => {
    setBusy(h.user_id); setNote(null);
    const me = await myGeohash();
    const { data, error } = await supabase.from('help_requests').insert({
      requester_id: userId,
      helper_id: h.user_id,
      service: h.services?.[0] || 'transport',
      requester_geohash: me?.hash || null,
      status: 'pending',
    }).select('id').maybeSingle();
    if (error) { setNote(error.message || 'Could not send request.'); setBusy(null); return; }
    try { await fetch('/api/help-notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ helper_id: h.user_id, request_id: data?.id }) }); } catch {}
    setNote('Request sent.');
    setBusy(null);
  };

  if (!userId || rows.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Helpers on duty</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 8 }}>
        {rows.map((h) => {
          const initial = (h.full_name || '?').charAt(0).toUpperCase();
          return (
            <View key={h.user_id} style={styles.card}>
              {h.avatar_url ? (
                <Image source={{ uri: h.avatar_url }} style={styles.av} />
              ) : (
                <View style={[styles.av, styles.avFb]}><Text style={styles.avTxt}>{initial}</Text></View>
              )}
              <Text style={styles.name} numberOfLines={1}>{h.full_name || 'Helper'}</Text>
              <Text style={styles.dist}>~{Math.max(1, Math.round(h.miles))} mi</Text>
              <View style={styles.pills}>
                {(h.services || []).slice(0, 3).map((s) => (
                  <View key={s} style={styles.pill}><Text style={styles.pillTxt}>{serviceLabel(s)}</Text></View>
                ))}
              </View>
              <TouchableOpacity style={styles.btn} disabled={busy === h.user_id} onPress={() => requestHelp(h)}>
                <Text style={styles.btnTxt}>{busy === h.user_id ? '…' : 'Request help'}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 8, gap: 8 },
  title: { fontFamily: Fonts.extrabold, fontSize: FontSizes.md, color: Colors.navy },
  note: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.tealDark },
  card: { width: 168, backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 12, gap: 6 },
  av: { width: 40, height: 40, borderRadius: 20 },
  avFb: { backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center' },
  avTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 16 },
  name: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy },
  dist: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.textSecondary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill: { backgroundColor: '#E4F3F1', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  pillTxt: { fontFamily: Fonts.bold, fontSize: 9, color: Colors.tealDark },
  btn: { backgroundColor: Colors.coral, borderRadius: 10, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  btnTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 12 },
});
