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

type Audience = 'owner' | 'shelter' | 'organization' | 'sponsor';
const TABS: { id: Audience; label: string }[] = [
  { id: 'owner', label: 'Owner' },
  { id: 'shelter', label: 'Shelter' },
  { id: 'organization', label: 'Organization' },
  { id: 'sponsor', label: 'Sponsor' },
];

type Row = {
  id: string;
  audience: Audience;
  vendor: string;
  description: string | null;
  amount_cents: number;
  status: string;
  created_at?: string;
};

const DEMO: Row[] = [
  ...GINA.invoices.map((inv, i) => ({
    id: `gina-${i}`,
    audience: 'owner' as Audience,
    vendor: inv.vendor,
    description: inv.desc,
    amount_cents: Math.round(Number(inv.amount.replace(/[^0-9.]/g, '')) * 100),
    status: inv.status,
  })),
  { id: 'sh-1', audience: 'shelter', vendor: 'Bond Vet (clinic)', description: 'Intake vaccines — 4 cats', amount_cents: 58000, status: 'Recorded · paid to clinic' },
  { id: 'org-1', audience: 'organization', vendor: 'ASPCA (official)', description: 'National campaign pointer', amount_cents: 0, status: 'We only open their donate page' },
  { id: 'sp-1', audience: 'sponsor', vendor: 'RUUMA', description: 'Sponsor underwrite — pending', amount_cents: 0, status: 'Not collected by Rescue Army' },
];

function money(cents: number) {
  if (!cents) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

export default function InvoicesScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Audience>('owner');
  const [rows, setRows] = useState<Row[]>(DEMO);
  const [fromDb, setFromDb] = useState(false);
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, audience, vendor, description, amount_cents, status, created_at')
      .order('created_at', { ascending: false });
    if (error || !data) {
      setFromDb(false);
      setRows(DEMO);
      setNote('Showing sample lines until the invoices table is created in Supabase (SQL Editor).');
      return;
    }
    setFromDb(true);
    setNote(null);
    setRows(data as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!vendor.trim()) return;
    setSaving(true);
    const cents = Math.round(Number(amount) * 100) || 0;
    const insert = {
      audience: tab,
      vendor: vendor.trim(),
      description: description.trim() || null,
      amount_cents: cents,
      status: 'recorded',
      created_by: user?.id ?? null,
    };
    const { error } = await supabase.from('invoices').insert(insert);
    setSaving(false);
    if (error) {
      setNote(error.message);
      return;
    }
    setVendor('');
    setAmount('');
    setDescription('');
    load();
  };

  const shown = rows.filter((r) => r.audience === tab);

  return (
    <SafeAreaView style={styles.wrap} edges={['top']}>
      <AppHeader title="Invoices" showBack />
      <View style={styles.phone}>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.id} style={[styles.tab, tab === t.id && styles.tabOn]} onPress={() => setTab(t.id)}>
              <Text style={[styles.tabTxt, tab === t.id && styles.tabTxtOn]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.kicker}>{tab.toUpperCase()}</Text>
          <Text style={styles.body}>
            Rescue Army records the line. Payment stays with the clinic, Lemonade, PayPal, or the org. We never hold the money.
          </Text>
          {note ? <Text style={styles.warn}>{note}</Text> : null}
          {shown.length === 0 ? <Text style={styles.muted}>No invoices in this role yet.</Text> : null}
          {shown.map((r) => (
            <View key={r.id} style={styles.card}>
              <Text style={styles.amt}>{money(r.amount_cents)}</Text>
              <Text style={styles.h2}>{r.vendor}</Text>
              {r.description ? <Text style={styles.body}>{r.description}</Text> : null}
              <Text style={styles.muted}>{r.status}</Text>
            </View>
          ))}
          <View style={styles.card}>
            <Text style={styles.h2}>Add a recorded line</Text>
            <TextInput style={styles.input} placeholder="Vendor (clinic / org)" value={vendor} onChangeText={setVendor} placeholderTextColor={Colors.textTertiary} />
            <TextInput style={styles.input} placeholder="Amount USD (optional)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor={Colors.textTertiary} />
            <TextInput style={styles.input} placeholder="What it was for" value={description} onChangeText={setDescription} placeholderTextColor={Colors.textTertiary} />
            <TouchableOpacity style={styles.btn} onPress={add} disabled={saving || !fromDb}>
              {saving ? <ActivityIndicator color={Colors.white} /> : (
                <Text style={styles.btnTxt}>{fromDb ? 'Save line' : 'Run SQL first (see note)'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.screen },
  phone: { flex: 1, width: '100%', maxWidth: 430, alignSelf: 'center' },
  tabs: { flexDirection: 'row', margin: 12, backgroundColor: Colors.surface, borderRadius: 999, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  tabOn: { backgroundColor: Colors.navy },
  tabTxt: { fontFamily: Fonts.bold, fontSize: 10, color: Colors.textSecondary },
  tabTxtOn: { color: Colors.white },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 10, color: Colors.coral, letterSpacing: 0.8 },
  h2: { fontFamily: Fonts.bold, fontSize: FontSizes.md, color: Colors.navy },
  body: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textSecondary, lineHeight: 20 },
  muted: { fontFamily: Fonts.regular, fontSize: FontSizes.sm, color: Colors.textTertiary, marginTop: 4 },
  warn: { fontFamily: Fonts.medium, fontSize: FontSizes.sm, color: Colors.accentDark, lineHeight: 20 },
  card: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, gap: 6 },
  amt: { fontFamily: Fonts.extrabold, fontSize: FontSizes.lg, color: Colors.navy },
  input: {
    borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12, fontFamily: Fonts.regular, color: Colors.text,
  },
  btn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  btnTxt: { color: Colors.white, fontFamily: Fonts.bold },
});
