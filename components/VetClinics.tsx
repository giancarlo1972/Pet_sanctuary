import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Building2, Phone, Trash2, Pencil } from 'lucide-react-native';
import { InlineBanner } from '@/components/InlineBanner';
import { ConfirmDialog, type ConfirmConfig } from '@/components/ConfirmDialog';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';

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
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vet_clinics').select('id, name, address, phone, website').order('name');
    setClinics((data as VetClinic[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', address: '', phone: '', website: '' });
    setModalVisible(true);
  };

  const openEdit = (c: VetClinic) => {
    setEditing(c);
    setForm({ name: c.name, address: c.address || '', phone: c.phone || '', website: c.website || '' });
    setModalVisible(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setBanner({ message: 'Clinic name is required.', kind: 'error' }); return; }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
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

  const rows: ClinicEntry[] = entries
    ? entries
    : clinics.map((c) => ({ name: c.name, phone: c.phone, address: c.address }));

  return (
    <View>
      {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}
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
        rows.map((c) => (
          <View key={c.name} style={styles.clinicCard}>
            <View style={styles.clinicInfo}>
              <Text style={styles.clinicName}>{c.name}</Text>
              {c.phone ? (
                <View style={styles.clinicRow}>
                  <Phone color={Colors.textSecondary} size={13} />
                  <Text style={styles.clinicDetail}>{c.phone}</Text>
                </View>
              ) : null}
              <Text style={styles.clinicDetail}>Last visit {formatDate(c.lastVisit)}</Text>
              <Text style={styles.clinicDetail}>{c.docCount ?? 0} document{(c.docCount ?? 0) === 1 ? '' : 's'}</Text>
              {c.address ? <Text style={styles.clinicDetail}>{c.address}</Text> : null}
            </View>
            {canEdit && !entries ? (
              <View style={styles.clinicActions}>
                <TouchableOpacity style={styles.clinicEditBtn} onPress={() => {
                  const match = clinics.find((x) => x.name === c.name);
                  if (match) openEdit(match);
                }} activeOpacity={0.85}>
                  <Pencil color={Colors.navy} size={14} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.clinicDeleteBtn} onPress={() => {
                  const match = clinics.find((x) => x.name === c.name);
                  if (match) del(match);
                }} activeOpacity={0.85}>
                  <Trash2 color={Colors.critical} size={14} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Clinic' : 'Add Clinic'}</Text>
            <Text style={styles.label}>Name *</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Clinic name" placeholderTextColor={Colors.textTertiary} />
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
  clinicName: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text, marginBottom: 4 },
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  clinicDetail: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  clinicActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
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
