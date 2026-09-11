import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Building2, Phone, Trash2, Pencil } from 'lucide-react-native';
import { InlineBanner } from '@/components/InlineBanner';
import { ConfirmDialog, type ConfirmConfig } from '@/components/ConfirmDialog';
import { SearchablePicker, type PickerItem } from '@/components/SearchablePicker';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { groupClinicEntries, normalizeClinicName, clinicKeysMatch } from '@/lib/clinic-name';

export interface VetClinic {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
}

export type ClinicEntry = {
  name: string;
  phone?: string | null;
  address?: string | null;
  lastVisit?: string | null;
  docCount?: number;
  variants?: string[];
  vets?: { name: string; lastVisit?: string | null }[];
};

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function VetClinics({
  petId, userId, canEdit, entries, onChanged,
}: {
  petId: string;
  userId: string;
  canEdit: boolean;
  entries?: ClinicEntry[];
  onChanged?: () => void;
}) {
  const [clinics, setClinics] = useState<VetClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<VetClinic | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', website: '' });
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vet_clinics').select('id, name, address, phone, website').order('name');
    setClinics((data as VetClinic[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const pickerItems: PickerItem[] = useMemo(
    () => clinics.map((c) => ({ id: c.id, name: c.name, label: c.name, sub: c.address || c.phone || undefined })),
    [clinics],
  );

  const openAdd = () => {
    setEditing(null);
    setPickedId(null);
    setForm({ name: '', address: '', phone: '', website: '' });
    setModalVisible(true);
  };

  const openEdit = (c: VetClinic) => {
    setEditing(c);
    setPickedId(c.id);
    setForm({ name: c.name, address: c.address || '', phone: c.phone || '', website: c.website || '' });
    setModalVisible(true);
  };

  const applyPick = (id: string | null, item: PickerItem | null) => {
    if (!item) {
      setPickedId(null);
      return;
    }
    const match = clinics.find((c) => c.id === id);
    setPickedId(id);
    setForm({
      name: item.name,
      address: match?.address || form.address,
      phone: match?.phone || form.phone,
      website: match?.website || form.website,
    });
  };

  const save = async () => {
    if (!form.name.trim()) { setBanner({ message: 'Clinic name is required.', kind: 'error' }); return; }
    const name = form.name.trim();
    const dup = clinics.find((c) => c.id !== editing?.id && (
      c.name.toLowerCase() === name.toLowerCase()
      || clinicKeysMatch(normalizeClinicName(c.name), normalizeClinicName(name))
    ));
    if (!editing && (pickedId || dup)) {
      setBanner({ message: 'Already on file — using that clinic.', kind: 'info' });
      setModalVisible(false);
      onChanged?.();
      return;
    }
    setSaving(true);
    const payload = {
      name,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      created_by: userId,
    };
    if (editing) {
      const { error } = await supabase.from('vet_clinics').update(payload).eq('id', editing.id);
      if (error) { setBanner({ message: error.message || 'Could not update clinic.', kind: 'error' }); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('vet_clinics').insert(payload);
      if (error) { setBanner({ message: error.message || 'Could not add clinic.', kind: 'error' }); setSaving(false); return; }
    }
    setSaving(false);
    setModalVisible(false);
    load();
    onChanged?.();
  };

  const del = (c: VetClinic) => {
    setConfirmConfig({
      title: 'Delete clinic?',
      message: 'This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from('vet_clinics').delete().eq('id', c.id);
        if (error) { setBanner({ message: 'Could not delete clinic.', kind: 'error' }); return; }
        load();
        onChanged?.();
      },
    });
  };

  const merge = (row: ClinicEntry) => {
    const variants = (row.variants || []).filter((v) => v && v !== row.name);
    if (!variants.length) return;
    setConfirmConfig({
      title: 'Merge clinic names?',
      message: `${variants.length + 1} variants will be saved as “${row.name}” on this pet’s documents and visits.`,
      confirmText: 'Merge',
      onConfirm: async () => {
        const keep = row.name;
        for (const v of variants) {
          await supabase.from('pet_documents').update({ clinic: keep }).eq('pet_id', petId).eq('clinic', v);
          await supabase.from('pet_vaccinations').update({ vet_clinic: keep }).eq('pet_id', petId).eq('vet_clinic', v);
          await supabase.from('pet_exams').update({ clinic: keep }).eq('pet_id', petId).eq('clinic', v);
          await supabase.from('medical_records').update({ clinic: keep }).eq('pet_id', petId).eq('clinic', v);
        }
        const keeper = clinics.find((c) => c.name.toLowerCase() === keep.toLowerCase());
        if (!keeper) {
          await supabase.from('vet_clinics').insert({ name: keep, address: row.address || null, phone: row.phone || null, created_by: userId });
        }
        setBanner({ message: `Merged into ${keep}.`, kind: 'success' });
        load();
        onChanged?.();
      },
    });
  };

  const rawRows: ClinicEntry[] = entries
    ? entries
    : clinics.map((c) => ({ name: c.name, phone: c.phone, address: c.address }));

  const rows = useMemo(() => {
    const grouped = groupClinicEntries(rawRows);
    return grouped.map((g) => {
      const members = rawRows.filter((r) => g.variants.includes(r.name));
      const dates = members.map((m) => m.lastVisit).filter(Boolean).sort() as string[];
      return {
        name: g.name,
        phone: members.find((m) => m.phone)?.phone || null,
        address: members.find((m) => m.address)?.address || null,
        lastVisit: dates[dates.length - 1] || null,
        docCount: members.reduce((s, m) => s + (m.docCount || 0), 0),
        variants: g.variants,
        vets: (() => {
          const map = new Map<string, { name: string; lastVisit?: string | null }>();
          for (const m of members) {
            for (const v of m.vets || []) {
              if (!v?.name) continue;
              const cur = map.get(v.name) || { name: v.name, lastVisit: v.lastVisit || null };
              if (v.lastVisit && (!cur.lastVisit || String(v.lastVisit) > String(cur.lastVisit))) cur.lastVisit = v.lastVisit;
              map.set(v.name, cur);
            }
          }
          return [...map.values()];
        })(),
      };
    }).sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || '') || a.name.localeCompare(b.name));
  }, [rawRows]);

  return (
    <View>
      {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
      {(() => {
        const vetN = new Set(rows.flatMap((r) => (r.vets || []).map((v) => v.name).filter(Boolean))).size;
        return (
          <View style={styles.headerTiles}>
            <View style={styles.headerTile}>
              <Text style={styles.headerTileN}>{rows.length}</Text>
              <Text style={styles.headerTileL}>Clinics</Text>
            </View>
            <View style={styles.headerTile}>
              <Text style={styles.headerTileN}>{vetN}</Text>
              <Text style={styles.headerTileL}>Veterinarians</Text>
            </View>
          </View>
        );
      })()}
      <View style={styles.subHeader}>
        <View style={styles.subHeaderLeft}>
          <Building2 color={Colors.navy} size={18} />
          <Text style={styles.subHeaderText}>Clinics</Text>
        </View>
        {canEdit && (
          <TouchableOpacity onPress={openAdd} activeOpacity={0.85}>
            <Text style={styles.addLink}>Add clinic</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && !entries ? (
        <ActivityIndicator size="small" color={Colors.coral} style={{ paddingVertical: 20 }} />
      ) : rows.length === 0 ? (
        <Text style={styles.emptyText}>No clinics on file yet.</Text>
      ) : (
        rows.map((c) => {
          const nVar = (c.variants || []).length;
          const match = clinics.find((x) => x.name === c.name) || clinics.find((x) => (c.variants || []).includes(x.name));
          return (
            <View key={c.name} style={styles.clinicCard}>
              <View style={styles.clinicInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.clinicName}>{c.name}</Text>
                  {nVar > 1 ? (
                    <View style={styles.varChip}>
                      <Text style={styles.varChipTxt}>{nVar} variants</Text>
                    </View>
                  ) : null}
                </View>
                {c.phone ? (
                  <View style={styles.clinicRow}>
                    <Phone color={Colors.textSecondary} size={13} />
                    <Text style={styles.clinicDetail}>{c.phone}</Text>
                  </View>
                ) : null}
                <Text style={styles.clinicDetail}>Last visit {formatDate(c.lastVisit)}</Text>
                <Text style={styles.clinicDetail}>{c.docCount ?? 0} document{(c.docCount ?? 0) === 1 ? '' : 's'}</Text>
                {c.address ? <Text style={styles.clinicDetail}>{c.address}</Text> : null}
                {(c.vets || []).length > 0 ? (
                  <View style={styles.vetList}>
                    {(c.vets || []).map((v) => (
                      <Text key={v.name} style={styles.vetLine}>
                        {v.name}{v.lastVisit ? ` · ${formatDate(v.lastVisit)}` : ''}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
              {canEdit ? (
                <View style={styles.clinicActions}>
                  {nVar > 1 ? (
                    <TouchableOpacity style={styles.mergeBtn} onPress={() => merge(c)} activeOpacity={0.85}>
                      <Text style={styles.mergeTxt}>Merge</Text>
                    </TouchableOpacity>
                  ) : null}
                  {match && !entries ? (
                    <>
                      <TouchableOpacity style={styles.clinicEditBtn} onPress={() => openEdit(match)} activeOpacity={0.85}>
                        <Pencil color={Colors.navy} size={14} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.clinicDeleteBtn} onPress={() => del(match)} activeOpacity={0.85}>
                        <Trash2 color={Colors.critical} size={14} />
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Clinic' : 'Add Clinic'}</Text>
            <Text style={styles.label}>Name *</Text>
            {editing ? (
              <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Clinic name" placeholderTextColor={Colors.textTertiary} />
            ) : (
              <SearchablePicker
                items={pickerItems}
                value={pickedId}
                onChange={applyPick}
                onCustom={(label) => { setPickedId(null); setForm((p) => ({ ...p, name: label })); }}
                placeholder="Search clinics…"
                allowCustom
              />
            )}
            {!!form.name && !editing ? <Text style={styles.clinicDetail}>{form.name}</Text> : null}
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={form.address} onChangeText={(v) => setForm((p) => ({ ...p, address: v }))} placeholder="123 Main St, City, ST" placeholderTextColor={Colors.textTertiary} />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))} placeholder="(555) 123-4567" placeholderTextColor={Colors.textTertiary} keyboardType="phone-pad" />
            <Text style={styles.label}>Website</Text>
            <TextInput style={styles.input} value={form.website} onChangeText={(v) => setForm((p) => ({ ...p, website: v }))} placeholder="https://..." placeholderTextColor={Colors.textTertiary} />
            <TouchableOpacity style={[styles.submitBtn, saving && styles.btnDisabled]} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.submitText}>{editing ? 'Save Changes' : 'Add Clinic'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmDialog config={confirmConfig} onClose={() => setConfirmConfig(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 16 },
  subHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subHeaderText: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text },
  addLink: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.coral },
  emptyText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
  clinicCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  clinicInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 },
  clinicName: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text },
  varChip: { backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  varChipTxt: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.navy },
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  clinicDetail: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  vetList: { marginTop: 8, gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  vetLine: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
  headerTiles: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  headerTile: { flex: 1, backgroundColor: Colors.white, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, paddingVertical: 14, alignItems: 'center' },
  headerTileN: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.navy },
  headerTileL: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  clinicActions: { flexDirection: 'column', gap: 8, alignItems: 'flex-end', justifyContent: 'center' },
  mergeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.navy },
  mergeTxt: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.white },
  clinicEditBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surface },
  clinicDeleteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.critical },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 16 },
  label: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.surface },
  submitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  submitText: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.white },
  btnDisabled: { opacity: 0.6 },
});
