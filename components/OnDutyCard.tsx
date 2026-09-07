import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Linking, Platform } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { encodeGeohash } from '@/lib/geohash';
import { HELPER_SERVICES, CONTACT_PREFS, hoursLeft, serviceLabel, type HelperStatus } from '@/lib/helper-duty';

type Req = { id: string; status: string; service: string | null; requester_id: string; created_at: string; profiles?: { full_name: string | null } | null };

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

export default function OnDutyCard({
  userId,
  phoneVerified,
  onBanner,
}: {
  userId: string;
  phoneVerified: boolean;
  onBanner: (kind: 'error' | 'success' | 'info', message: string) => void;
}) {
  const [row, setRow] = useState<HelperStatus | null>(null);
  const [incoming, setIncoming] = useState<Req[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(async () => {
    const { data } = await supabase.from('helper_status').select('*').eq('user_id', userId).maybeSingle();
    let next = data as HelperStatus | null;
    if (next?.on_duty && next.until_at && new Date(next.until_at).getTime() < Date.now()) {
      await supabase.from('helper_status').update({ on_duty: false, until_at: null }).eq('user_id', userId);
      next = { ...next, on_duty: false, until_at: null };
    }
    setRow(next);
    const { data: reqs } = await supabase
      .from('help_requests')
      .select('id, status, service, requester_id, created_at')
      .eq('helper_id', userId)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(20);
    const list = (reqs || []) as Req[];
    setIncoming(list);
    setPendingCount(list.filter((r) => r.status === 'pending').length);
  }, [userId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel('help-me-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'help_requests', filter: `helper_id=eq.${userId}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, load]);

  const upsert = async (patch: Partial<HelperStatus>, goingOn = false) => {
    const services = patch.services ?? row?.services ?? [];
    const prefs = patch.contact_prefs ?? row?.contact_prefs ?? ['inapp'];
    if (goingOn && services.length < 1) { onBanner('error', 'Pick at least one service before going on duty.'); return; }
    if ((prefs.includes('text') || prefs.includes('call')) && !phoneVerified) {
      onBanner('error', 'Verify your phone to enable text or call.'); return;
    }
    let geohash = row?.geohash || null;
    if (goingOn || patch.on_duty) {
      geohash = await currentGeohash() || geohash;
      if (!geohash) { onBanner('error', 'Location is needed to go on duty (stored as an approximate area only).'); return; }
    }
    const payload = {
      user_id: userId,
      on_duty: patch.on_duty ?? row?.on_duty ?? false,
      services,
      radius_mi: patch.radius_mi ?? row?.radius_mi ?? 5,
      contact_prefs: prefs.includes('inapp') ? prefs : ['inapp', ...prefs],
      geohash,
      until_at: (patch.on_duty ?? row?.on_duty) ? new Date(Date.now() + 8 * 3600 * 1000).toISOString() : null,
    };
    const { data, error } = await supabase.from('helper_status').upsert(payload).select('*').maybeSingle();
    if (error) { onBanner('error', error.message || 'Could not update duty status.'); return; }
    setRow(data as HelperStatus);
  };

  const toggleService = (key: string) => {
    const cur = row?.services || [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    upsert({ services: next });
  };
  const togglePref = (key: string) => {
    if (key === 'inapp') return;
    if ((key === 'text' || key === 'call') && !phoneVerified) {
      onBanner('info', 'Verify your phone in Trust & Verification first.');
      return;
    }
    const cur = row?.contact_prefs || ['inapp'];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    upsert({ contact_prefs: next.length ? next : ['inapp'] });
  };

  const decide = async (id: string, status: 'accepted' | 'declined' | 'done') => {
    const { error } = await supabase.from('help_requests').update({ status, decided_at: new Date().toISOString() }).eq('id', id);
    if (error) onBanner('error', error.message || 'Could not update request.');
    else load();
  };

  const call = async (id: string) => {
    const { data, error } = await supabase.rpc('help_request_call_number', { p_id: id });
    if (error || !data) { onBanner('error', 'No phone on file for this request.'); return; }
    Linking.openURL(`tel:${data}`);
  };

  const left = hoursLeft(row?.until_at || null);
  const on = Boolean(row?.on_duty) && left > 0;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>ON DUTY</Text>
          {on ? (
            <Text style={styles.active}>On duty · {Math.max(1, Math.round(left))} h left · {pendingCount} request{pendingCount === 1 ? '' : 's'}</Text>
          ) : (
            <Text style={styles.hint}>Help nearby animals for up to 8 hours</Text>
          )}
        </View>
        <Switch
          value={on}
          onValueChange={(v) => upsert({ on_duty: v }, v)}
          trackColor={{ false: Colors.borderInput, true: Colors.teal }}
          thumbColor={Colors.white}
        />
      </View>

      <Text style={styles.sub}>Services</Text>
      <View style={styles.pills}>
        {HELPER_SERVICES.map((s) => {
          const onS = (row?.services || []).includes(s.key);
          return (
            <TouchableOpacity key={s.key} style={[styles.pill, onS && styles.pillOn]} onPress={() => toggleService(s.key)}>
              <Text style={[styles.pillTxt, onS && styles.pillTxtOn]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sub}>Contact</Text>
      <View style={styles.pills}>
        {CONTACT_PREFS.map((p) => {
          const locked = (p.key === 'text' || p.key === 'call') && !phoneVerified;
          const onP = (row?.contact_prefs || ['inapp']).includes(p.key);
          return (
            <TouchableOpacity key={p.key} style={[styles.pill, onP && styles.pillOn, locked && { opacity: 0.45 }]} onPress={() => togglePref(p.key)}>
              <Text style={[styles.pillTxt, onP && styles.pillTxtOn]}>{p.label}{locked ? ' 🔒' : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sub}>Radius · {row?.radius_mi || 5} mi</Text>
      {Platform.OS === 'web' ? (
        <input
          type="range" min={1} max={25} value={row?.radius_mi || 5}
          onChange={(e: any) => upsert({ radius_mi: Math.max(1, Math.min(25, parseInt(e.target.value, 10) || 5)) })}
          style={{ width: '100%', accentColor: Colors.navy }}
        />
      ) : (
        <View style={styles.pills}>
          {[1, 5, 10, 15, 25].map((n) => (
            <TouchableOpacity key={n} style={[styles.pill, (row?.radius_mi || 5) === n && styles.pillOn]} onPress={() => upsert({ radius_mi: n })}>
              <Text style={[styles.pillTxt, (row?.radius_mi || 5) === n && styles.pillTxtOn]}>{n} mi</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={styles.fine}>Location is stored as a ~5 km area code, never an exact pin.</Text>

      {incoming.length > 0 ? (
        <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={styles.sub}>Requests</Text>
          {incoming.map((r) => (
            <View key={r.id} style={styles.req}>
              <Text style={styles.reqTitle}>{serviceLabel(r.service || '') || 'Help request'} · {r.status}</Text>
              <View style={styles.reqRow}>
                {r.status === 'pending' ? (
                  <>
                    <TouchableOpacity style={styles.ok} onPress={() => decide(r.id, 'accepted')}><Text style={styles.okTxt}>Accept</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.no} onPress={() => decide(r.id, 'declined')}><Text style={styles.noTxt}>Decline</Text></TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.call} onPress={() => call(r.id)}><Text style={styles.callTxt}>Call</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.ok} onPress={() => decide(r.id, 'done')}><Text style={styles.okTxt}>Done</Text></TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 10, marginBottom: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.8 },
  active: { fontFamily: Fonts.semibold, fontSize: 12, color: Colors.tealDark, marginTop: 2 },
  hint: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sub: { fontFamily: Fonts.extrabold, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.6, marginTop: 4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillOn: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.navy },
  pillTxtOn: { color: Colors.white },
  fine: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textTertiary },
  req: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 10, gap: 8 },
  reqTitle: { fontFamily: Fonts.semibold, fontSize: 13, color: Colors.navy },
  reqRow: { flexDirection: 'row', gap: 8 },
  ok: { flex: 1, backgroundColor: Colors.teal, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  okTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 12 },
  no: { flex: 1, borderWidth: 1.5, borderColor: Colors.critical, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  noTxt: { color: Colors.critical, fontFamily: Fonts.bold, fontSize: 12 },
  call: { flex: 1, backgroundColor: Colors.navy, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  callTxt: { color: Colors.white, fontFamily: Fonts.bold, fontSize: 12 },
});
