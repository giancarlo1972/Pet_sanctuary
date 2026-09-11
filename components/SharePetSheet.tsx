import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator, Share, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { SHARE_LEVELS, type ShareLevel } from '@/lib/admin-access';
import { publicShareUrl } from '@/lib/share-invite';

type Rel = {
  id: string;
  user_id: string;
  relationship: string;
  started_on: string | null;
  profiles?: { full_name: string | null; email: string | null } | null;
};

export default function SharePetSheet({
  visible, petId, petName, onClose,
}: { visible: boolean; petId: string; petName: string; onClose: () => void }) {
  const [level, setLevel] = useState<ShareLevel>('caretaker');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [people, setPeople] = useState<Rel[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('pet_relationships')
      .select('id, user_id, relationship, started_on')
      .eq('pet_id', petId)
      .is('ended_on', null)
      .order('started_on', { ascending: false });
    const rows = (data as Rel[]) || [];
    const ids = rows.map((r) => r.user_id);
    let names: Record<string, { full_name: string | null; email: string | null }> = {};
    if (ids.length) {
      const { data: ppl } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      (ppl || []).forEach((p: any) => { names[p.id] = { full_name: p.full_name, email: p.email }; });
    }
    setPeople(rows.map((r) => ({ ...r, profiles: names[r.user_id] || null })));
  }, [petId]);

  useEffect(() => { if (visible) { setLink(null); setError(null); load(); } }, [visible, load]);

  const createInvite = async () => {
    setBusy(true); setError(null); setLink(null);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error: e } = await supabase.from('pet_share_invites').insert({
      pet_id: petId,
      level,
      invited_email: email.trim().toLowerCase() || null,
      invited_by: user?.id,
    }).select('token').maybeSingle();
    setBusy(false);
    if (e || !data?.token) { setError(e?.message || 'Could not create invite.'); return; }
    setLink(publicShareUrl(data.token));
  };

  const revoke = async (id: string) => {
    setBusy(true);
    await supabase.from('pet_relationships').update({ ended_on: new Date().toISOString().slice(0, 10) }).eq('id', id);
    setBusy(false);
    load();
  };

  const shareLink = async () => {
    if (!link) return;
    try {
      await Share.share({ message: `Join ${petName} on Rescue Army as ${level}: ${link}`, url: link });
    } catch {}
  };

  if (!visible) return null;
  const qr = link ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(link)}` : null;

  return (
    <View style={styles.scrim}>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Text style={styles.title}>Share {petName}</Text>
          <TouchableOpacity onPress={onClose} style={styles.close}><X color={Colors.navy} size={18} /></TouchableOpacity>
        </View>
        <Text style={styles.hint}>Owner-only. They get access at the level you pick. You can revoke anytime.</Text>
        <View style={styles.levels}>
          {SHARE_LEVELS.map((l) => (
            <TouchableOpacity key={l.key} onPress={() => setLevel(l.key)} style={[styles.level, level === l.key && styles.levelOn]}>
              <Text style={[styles.levelT, level === l.key && styles.levelTOn]}>{l.label}</Text>
              <Text style={styles.levelH}>{l.hint}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
          placeholder="Optional email" placeholderTextColor={Colors.textTertiary} style={styles.input}
        />
        <TouchableOpacity style={styles.primary} onPress={createInvite} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryT}>Create invite link</Text>}
        </TouchableOpacity>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        {link ? (
          <View style={styles.linkBox}>
            {qr ? <Image source={{ uri: qr }} style={styles.qr} /> : null}
            <Text selectable style={styles.link}>{link}</Text>
            <TouchableOpacity onPress={shareLink}><Text style={styles.copy}>Share link / QR</Text></TouchableOpacity>
          </View>
        ) : null}
        <Text style={styles.kicker}>People with access</Text>
        {people.length === 0 ? <Text style={styles.meta}>Only you so far.</Text> : null}
        {people.map((p) => (
          <View key={p.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.profiles?.full_name || p.profiles?.email || 'Person'}</Text>
              <Text style={styles.meta}>{p.relationship}{p.started_on ? ` · since ${p.started_on}` : ''}</Text>
            </View>
            {p.relationship !== 'owner' && p.relationship !== 'own' ? (
              <TouchableOpacity onPress={() => revoke(p.id)} disabled={busy}><Text style={styles.revoke}>Revoke</Text></TouchableOpacity>
            ) : <Text style={styles.meta}>Owner</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 40 },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10, maxHeight: '92%' },
  head: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1, fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.navy },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: Fonts.regular, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  levels: { gap: 8 },
  level: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 10 },
  levelOn: { borderColor: Colors.navy, backgroundColor: '#EEF0F8' },
  levelT: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy },
  levelTOn: { color: Colors.navy },
  levelH: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textTertiary, marginTop: 2 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'web' ? 10 : 12, fontFamily: Fonts.regular, color: Colors.text },
  primary: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryT: { color: Colors.white, fontFamily: Fonts.bold },
  err: { color: Colors.critical, fontFamily: Fonts.medium, fontSize: 12 },
  linkBox: { alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: 12, padding: 12 },
  qr: { width: 180, height: 180 },
  link: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.navy, textAlign: 'center' },
  copy: { fontFamily: Fonts.bold, color: Colors.coral },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.7, textTransform: 'uppercase', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  name: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy },
  meta: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textSecondary },
  revoke: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.critical },
});
