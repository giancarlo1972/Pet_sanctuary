import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '@/components/AppHeader';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/context/AuthContext';
import { GINA } from '@/lib/gina-record';

type Share = 'owner' | 'clinic' | 'shelter' | 'organization' | 'sponsor';
const SHARES: { id: Share; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'clinic', label: 'Clinic' },
  { id: 'shelter', label: 'Shelter' },
  { id: 'organization', label: 'Org' },
  { id: 'sponsor', label: 'Sponsor' },
];

type PetOpt = { id: string; name: string; canManage: boolean };

type Row = {
  id: string;
  pet_id: string | null;
  vendor: string;
  description: string | null;
  amount_cents: number;
  status: string;
  shared_with?: string[] | null;
};

const GINA_PET: PetOpt = { id: 'gina-demo', name: 'Gina', canManage: true };

const DEMO: Row[] = GINA.invoices.map((inv, i) => ({
  id: `gina-${i}`,
  pet_id: 'gina-demo',
  vendor: inv.vendor,
  description: inv.desc,
  amount_cents: Math.round(Number(inv.amount.replace(/[^0-9.]/g, '')) * 100),
  status: inv.status,
  shared_with: ['owner', 'clinic'],
}));

function money(cents: number) {
  if (!cents) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

export default function InvoicesScreen() {
  const { user } = useAuth();
  const [pets, setPets] = useState<PetOpt[]>([GINA_PET]);
  const [petId, setPetId] = useState('gina-demo');
  const [filter, setFilter] = useState<Share | 'all'>('all');
  const [rows, setRows] = useState<Row[]>(DEMO);
  const [fromDb, setFromDb] = useState(false);
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [share, setShare] = useState<Share[]>(['owner', 'clinic']);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const pet = pets.find((p) => p.id === petId) ?? pets[0];

  const loadPets = useCallback(async () => {
    if (!user) return;
    const { data: owned } = await supabase.from('pets').select('id, name, owner_id').eq('owner_id', user.id);
    const { data: rels } = await supabase
      .from('pet_relationships')
      .select('pet_id, relationship, ended_on')
      .eq('user_id', user.id)
      .is('ended_on', null);
    const relIds = (rels ?? []).map((r) => r.pet_id);
    let relPets: { id: string; name: string | null }[] = [];
    if (relIds.length) {
      const { data } = await supabase.from('pets').select('id, name').in('id', relIds);
      relPets = data ?? [];
    }
    const map = new Map<string, PetOpt>();
    map.set(GINA_PET.id, GINA_PET);
    (owned ?? []).forEach((p) => map.set(p.id, { id: p.id, name: p.name || 'Pet', canManage: true }));
    relPets.forEach((p) => {
      const rel = (rels ?? []).find((r) => r.pet_id === p.id);
      const manage = rel?.relationship === 'owner' || rel?.relationship === 'foster';
      if (!map.has(p.id)) map.set(p.id, { id: p.id, name: p.name || 'Pet', canManage: manage });
      else if (manage) map.set(p.id, { ...map.get(p.id)!, canManage: true });
    });
    const list = [...map.values()];
    setPets(list);
    if (!list.find((p) => p.id === petId) && list[0]) setPetId(list[0].id);
  }, [user, petId]);

  const loadRows = useCallback(async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, pet_id, vendor, description, amount_cents, status, shared_with')
      .order('created_at', { ascending: false });
    if (error || !data) {
      setFromDb(false);
      setRows(DEMO);
      setNote('Sample lines until invoices exist in Supabase. Owner of a pet always manages that pet\u2019s documents.');
      return;
    }
    setFromDb(true);
    setNote(null);
    setRows(data as Row[]);
  }, []);

  useEffect(() => { loadPets(); loadRows(); }, [loadPets, loadRows]);

  const toggleShare = (s: Share) => {
    if (s === 'owner') return;
    setShare((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  };

  const add = async () => {
    if (!vendor.trim() || !pet?.canManage) return;
    setSaving(true);
    const cents = Math.round(Number(amount) * 100) || 0;
    const { error } = await supabase.from('invoices').insert({
      audience: 'owner',
      pet_id: petId === 'gina-demo' ? null : petId,
      vendor: vendor.trim(),
      description: description.trim() || null,
      amount_cents: cents,
      status: 'recorded',
      shared_with: share,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) { setNote(error.message); return; }
    setVendor(''); setAmount(''); setDescription('');
    loadRows();
  };

  const shown = rows.filter((r) => {
    const samePet = r.pet_id === petId || (petId === 'gina-demo' && !r.pet_id);
    if (!samePet && !(petId === 'gina-demo' && r.pet_id === 'gina-demo')) return false;
    if (filter === 'all') return true;
    const sw = r.shared_with ?? ['owner'];
    return sw.includes(filter);
  });

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <AppHeader title="Invoices" showBack />
      <View style={styles.phone}>
        <ScrollView contentContainerStyle={styles.scroll} horizontal={false}>
          <Text style={styles.kicker}>ATTACHED TO THE PET</Text>
          <Text style={styles.body}>
            If you own the pet, you manage its invoices and clinic papers. Clinics share with the owner. Shelter, org, and sponsor only see a line if it is shared with them. Rescue Army never holds the money.
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petRow}>
            {pets.map((p) => (
              <TouchableOpacity key={p.id} style={[styles.petChip, petId === p.id && styles.petChipOn]} onPress={() => setPetId(p.id)}>
                <Text style={[styles.petChipTxt, petId === p.id && styles.petChipTxtOn]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, filter === 'all' && styles.tabOn]} onPress={() => setFilter('all')}>
              <Text style={[styles.tabTxt, filter === 'all' && styles.tabTxtOn]}>All</Text>
            </TouchableOpacity>
            {SHARES.map((t) => (
              <TouchableOpacity key={t.id} style={[styles.tab, filter === t.id && styles.tabOn]} onPress={() => setFilter(t.id)}>
                <Text style={[styles.tabTxt, filter === t.id && styles.tabTxtOn]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {note ? <Text style={styles.warn}>{note}</Text> : null}
          {shown.length === 0 ? <Text style={styles.muted}>No invoices for this pet / share yet.</Text> : null}
          {shown.map((r) => (
            <View key={r.id} style={styles.card}>
              <Text style={styles.amt}>{money(r.amount_cents)}</Text>
              <Text style={styles.h2}>{r.vendor}</Text>
              {r.description ? <Text style={styles.body}>{r.description}</Text> : null}
              <Text style={styles.muted}>{r.status}</Text>
              <Text style={styles.shareLine}>Shared: {(r.shared_with ?? ['owner']).join(', ')}</Text>
            </View>
          ))}

          {pet?.canManage ? (
            <View style={styles.card}>
              <Text style={styles.h2}>Clinic / owner — add a line for {pet.name}</Text>
              <TextInput style={styles.input} placeholder="Clinic or vendor" value={vendor} onChangeText={setVendor} placeholderTextColor={Colors.textTertiary} />
              <TextInput style={styles.input} placeholder="Amount USD (optional)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={Colors.textTertiary} />
              <TextInput style={styles.input} placeholder="What it was for" value={description} onChangeText={setDescription} placeholderTextColor={Colors.textTertiary} />
              <Text style={styles.muted}>Share with (owner is always on)</Text>
              <View style={styles.shareRow}>
                {SHARES.map((s) => {
                  const on = share.includes(s.id);
                  return (
                    <TouchableOpacity key={s.id} style={[styles.shareChip, on && styles.shareChipOn]} onPress={() => toggleShare(s.id)}>
                      <Text style={[styles.shareChipTxt, on && styles.shareChipTxtOn]}>{s.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.btn} onPress={add} disabled={saving || !fromDb}>
                {saving ? <ActivityIndicator color={Colors.white} /> : (
                  <Text style={styles.btnTxt}>{fromDb ? 'Save to this pet' : 'Run SQL first, then save'}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.muted}>You can view shared lines. Only the pet’s owner (or clinic they share with) can add.</Text>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  phone: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center' },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 10, color: Colors.coral, letterSpacing: 0.8 },
  h2: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.navy },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
  muted: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textTertiary, marginTop: 4 },
  warn: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, color: Colors.accentDark, lineHeight: 20 },
  petRow: { gap: 8, paddingVertical: 4 },
  petChip: { backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  petChipOn: { backgroundColor: Colors.navy },
  petChipTxt: { fontFamily: Fonts.bold, color: Colors.navy, fontSize: FontSizes.sm },
  petChipTxtOn: { color: Colors.white },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: Colors.surface },
  tabOn: { backgroundColor: Colors.navy },
  tabTxt: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.textSecondary },
  tabTxtOn: { color: Colors.white },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, gap: 6 },
  amt: { fontFamily: Fonts.extrabold, fontSize: FontSizes.lg, color: Colors.navy },
  shareLine: { fontFamily: Fonts.medium, fontSize: 11, color: Colors.tealDark },
  input: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12, fontFamily: Fonts.regular, color: Colors.text,
  },
  shareRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shareChip: { borderWidth: 1, borderColor: Colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  shareChipOn: { backgroundColor: Colors.tealBg, borderColor: Colors.teal },
  shareChipTxt: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.textSecondary },
  shareChipTxtOn: { color: Colors.tealDark },
  btn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnTxt: { color: Colors.white, fontFamily: Fonts.bold },
});
