import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity, Modal, TextInput, Platform, Pressable,
} from 'react-native';
import { MapPin } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { encodeGeohash } from '@/lib/geohash';
import { PROVIDER_SERVICES } from '@/lib/role-categories';
import { serviceLabel } from '@/lib/helper-duty';

const INTER = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.regular;
const INTER7 = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : Fonts.bold;

function scheduleSummary(raw: any): string {
  if (!raw) return 'always';
  if (typeof raw === 'string') return raw.trim() || 'always';
  const note = String(raw.note || raw.summary || '').trim();
  return note || 'always';
}

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

export default function VisibilityCard({
  userId,
  volunteerActive,
  onBanner,
  onChanged,
}: {
  userId: string;
  volunteerActive: boolean;
  onBanner?: (kind: 'error' | 'success' | 'info', message: string) => void;
  onChanged?: () => void;
}) {
  const [spp, setSpp] = useState<any | null>(null);
  const [helper, setHelper] = useState<any | null>(null);
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [note, setNote] = useState('');
  const [radius, setRadius] = useState(10);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: h }] = await Promise.all([
      supabase.from('service_provider_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('helper_status').select('*').eq('user_id', userId).maybeSingle(),
    ]);
    setSpp(p || null);
    setHelper(h || null);
    setNote(scheduleSummary(p?.availability) === 'always' ? '' : scheduleSummary(p?.availability));
    setRadius(Number(p?.radius_mi || h?.radius_mi || 10));
    setReady(true);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const visible = Boolean(spp) || volunteerActive;
  if (ready && !visible) return null;

  const on = Boolean(spp?.show_on_map) || Boolean(helper?.on_duty);
  const services: string[] = [
    ...new Set([...(spp?.services || []), ...(helper?.services || [])]),
  ];
  const svcTxt = services.map((k) => PROVIDER_SERVICES.find((x) => x.key === k)?.label || serviceLabel(k)).filter(Boolean).join(' · ') || 'help';
  const sub = on
    ? `On Nearby map & Trending · ${svcTxt} · ${radius} mi · ${scheduleSummary(spp?.availability)}`
    : 'Hidden — turn on to be found nearby';

  const setOn = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const svc = services.length ? services : ['transport'];
      const geohash = next ? (await currentGeohash()) || helper?.geohash || null : helper?.geohash || null;
      const { error: e1 } = await supabase.from('service_provider_profiles').upsert({
        user_id: userId,
        services: spp?.services?.length ? spp.services : svc,
        bio: spp?.bio || null,
        rate_text: spp?.rate_text || null,
        radius_mi: radius,
        availability: spp?.availability || { note: note.trim() || 'always' },
        show_on_map: next,
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('helper_status').upsert({
        user_id: userId,
        on_duty: next,
        services: helper?.services?.length ? helper.services : svc,
        radius_mi: radius,
        contact_prefs: helper?.contact_prefs?.length ? helper.contact_prefs : ['inapp'],
        geohash,
        until_at: next ? new Date(Date.now() + 8 * 3600 * 1000).toISOString() : null,
      });
      if (e2) throw e2;
      await load();
      onChanged?.();
    } catch (e: any) {
      onBanner?.('error', e?.message || 'Could not update visibility.');
    } finally {
      setBusy(false);
    }
  };

  const saveSchedule = async () => {
    setBusy(true);
    try {
      const availability = { note: note.trim() || 'always' };
      const { error: e1 } = await supabase.from('service_provider_profiles').upsert({
        user_id: userId,
        services: spp?.services?.length ? spp.services : ['transport'],
        bio: spp?.bio || null,
        rate_text: spp?.rate_text || null,
        radius_mi: radius,
        availability,
        show_on_map: Boolean(spp?.show_on_map) || on,
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('helper_status').upsert({
        user_id: userId,
        on_duty: helper?.on_duty ?? on,
        services: helper?.services?.length ? helper.services : (spp?.services || ['transport']),
        radius_mi: radius,
        contact_prefs: helper?.contact_prefs?.length ? helper.contact_prefs : ['inapp'],
        geohash: helper?.geohash || null,
        until_at: helper?.until_at || null,
      });
      if (e2) throw e2;
      setSheet(false);
      await load();
      onChanged?.();
    } catch (e: any) {
      onBanner?.('error', e?.message || 'Could not save schedule.');
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;

  return (
    <>
      <View style={s.card}>
        <View style={s.row}>
          <View style={s.icon}><MapPin color={Colors.teal} size={16} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Visible to helpers & shelters</Text>
            <Text style={s.sub}>{sub}</Text>
          </View>
          <Switch
            value={on}
            onValueChange={setOn}
            disabled={busy}
            trackColor={{ true: '#2E9E96', false: '#C7CBD6' }}
            thumbColor="#fff"
          />
        </View>
        <TouchableOpacity onPress={() => setSheet(true)} activeOpacity={0.85} style={s.schedWrap}>
          <Text style={s.sched}>Schedule →</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheet(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Availability</Text>
            <Text style={s.sheetHint}>Shown on Nearby when you are visible.</Text>
            <TextInput
              style={s.input}
              value={note}
              onChangeText={setNote}
              placeholder="always"
              placeholderTextColor="#9AA1AC"
            />
            <Text style={s.sheetHint}>Radius · {radius} mi</Text>
            <View style={s.pills}>
              {[1, 5, 10, 15, 25].map((n) => (
                <TouchableOpacity key={n} style={[s.pill, radius === n && s.pillOn]} onPress={() => setRadius(n)}>
                  <Text style={[s.pillTxt, radius === n && s.pillTxtOn]}>{n} mi</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={s.save} onPress={saveSchedule} disabled={busy} activeOpacity={0.85}>
              <Text style={s.saveTxt}>{busy ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSheet(false)}><Text style={s.cancel}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#D9DCE6',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#E4F3F1',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: INTER7, fontWeight: '700', fontSize: 13.5, color: '#26265E',
  },
  sub: {
    fontFamily: INTER, fontWeight: '400', fontSize: 11.5, color: '#6B7280', marginTop: 2,
  },
  schedWrap: { marginTop: 10, alignSelf: 'flex-start' },
  sched: { fontFamily: INTER7, fontWeight: '700', fontSize: 13, color: '#E85A50' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,15,40,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32, gap: 10,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDE0E7', alignSelf: 'center' },
  sheetTitle: { fontFamily: INTER7, fontWeight: '700', fontSize: 16, color: '#26265E' },
  sheetHint: { fontFamily: INTER, fontSize: 12, color: '#6B7280' },
  input: {
    borderWidth: 1, borderColor: '#E8EAF0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: INTER, color: '#26265E',
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: '#EEF0F4', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  pillOn: { backgroundColor: '#26265E', borderColor: '#26265E' },
  pillTxt: { fontFamily: INTER7, fontWeight: '700', fontSize: 12, color: '#26265E' },
  pillTxtOn: { color: '#fff' },
  save: { backgroundColor: '#E85A50', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  saveTxt: { fontFamily: INTER7, fontWeight: '700', fontSize: 15, color: '#fff' },
  cancel: { fontFamily: INTER7, fontWeight: '700', fontSize: 14, color: '#6B7280', textAlign: 'center', paddingVertical: 8 },
});
