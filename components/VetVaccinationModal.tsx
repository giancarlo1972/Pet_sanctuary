import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Search, Plus, ChevronDown, Syringe, CircleAlert, Clock, CheckCircle, FileText, Trash2, History } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { InlineBanner } from '@/components/InlineBanner';
import { ConfirmDialog, type ConfirmConfig } from '@/components/ConfirmDialog';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { useSignedUrl } from '@/hooks/useSignedUrls';

export interface Vaccination {
  id: string;
  vaccine: string;
  vaccine_type: string | null;
  duration_years: number | null;
  administered_on: string | null;
  next_due_on: string | null;
  vet_clinic: string | null;
  clinic_id: string | null;
  vet_name: string | null;
  vet_license: string | null;
  lot_number: string | null;
  lot_expires_on: string | null;
  manufacturer: string | null;
  injection_site: string | null;
  tag_number: string | null;
  is_booster: boolean | null;
  superseded: boolean | null;
  notes: string | null;
  document_url: string | null;
}

export interface VetClinic {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
}

const VACCINE_TYPES = ['FVRCP', 'Rabies', 'DHPP', 'Bordetella', 'Leptospirosis', 'Lyme', 'Canine Influenza', 'Feline Leukemia', 'Other'];
const VACCINE_FORMULATION_TYPES = ['recombinant', 'killed', 'MLV', 'other'];
const DURATION_OPTIONS = [
  { label: '1 year', years: 1 },
  { label: '3 year', years: 3 },
  { label: 'No expiration', years: 0 },
];

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function vaccinationStatus(nextDue: string | null): 'overdue' | 'due-soon' | 'ok' | 'none' {
  if (!nextDue) return 'none';
  const days = daysUntil(nextDue);
  if (days === null) return 'none';
  if (days < 0) return 'overdue';
  if (days <= 30) return 'due-soon';
  return 'ok';
}

function autoCalcNextDue(administeredOn: string, durationYears: number): string {
  if (!administeredOn || durationYears <= 0) return '';
  const d = new Date(administeredOn);
  if (Number.isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + durationYears);
  return d.toISOString().slice(0, 10);
}

interface VaxFormState {
  vaccine: string;
  vaccine_type: string;
  formulation_type: string;
  duration_years: number;
  administered_on: string;
  next_due_on: string;
  next_due_locked: boolean;
  vet_clinic: string;
  clinic_id: string | null;
  vet_name: string;
  vet_license: string;
  lot_number: string;
  lot_expires_on: string;
  manufacturer: string;
  injection_site: string;
  tag_number: string;
  is_booster: boolean;
  notes: string;
  certificate_file: ImagePicker.ImagePickerAsset | null;
}

const emptyForm: VaxFormState = {
  vaccine: '', vaccine_type: '', formulation_type: '', duration_years: 1,
  administered_on: '', next_due_on: '', next_due_locked: false,
  vet_clinic: '', clinic_id: null, vet_name: '', vet_license: '',
  lot_number: '', lot_expires_on: '', manufacturer: '', injection_site: '',
  tag_number: '', is_booster: false, notes: '', certificate_file: null,
};

export function VetVaccinationModal({
  petId, userId, editing, clinics, onSaved, onClose, visible,
}: {
  petId: string;
  userId: string;
  editing: Vaccination | null;
  clinics: VetClinic[];
  onSaved: () => void;
  onClose: () => void;
  visible: boolean;
}) {
  const [form, setForm] = useState<VaxFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [clinicSearch, setClinicSearch] = useState('');
  const [showClinicPicker, setShowClinicPicker] = useState(false);
  const [showAddClinic, setShowAddClinic] = useState(false);
  const [newClinic, setNewClinic] = useState({ name: '', address: '', phone: '', website: '' });
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);

  useEffect(() => {
    if (visible) {
      if (editing) {
        setForm({
          vaccine: editing.vaccine || '',
          vaccine_type: editing.vaccine_type || '',
          formulation_type: '',
          duration_years: editing.duration_years ?? 1,
          administered_on: editing.administered_on || '',
          next_due_on: editing.next_due_on || '',
          next_due_locked: true,
          vet_clinic: editing.vet_clinic || '',
          clinic_id: editing.clinic_id,
          vet_name: editing.vet_name || '',
          vet_license: editing.vet_license || '',
          lot_number: editing.lot_number || '',
          lot_expires_on: editing.lot_expires_on || '',
          manufacturer: editing.manufacturer || '',
          injection_site: editing.injection_site || '',
          tag_number: editing.tag_number || '',
          is_booster: editing.is_booster ?? false,
          notes: editing.notes || '',
          certificate_file: null,
        });
      } else {
        setForm(emptyForm);
      }
      setBanner(null);
    }
  }, [visible, editing]);

  const pickCertificate = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) setForm((p) => ({ ...p, certificate_file: { uri: URL.createObjectURL(file), name: file.name, mimeType: file.type } as any }));
      };
      input.click();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) setForm((p) => ({ ...p, certificate_file: result.assets![0] }));
  };

  const addNewClinic = async () => {
    if (!newClinic.name.trim()) { setBanner({ message: 'Clinic name is required.', kind: 'error' }); return; }
    const { data, error } = await supabase.from('vet_clinics').insert({
      name: newClinic.name.trim(), address: newClinic.address.trim() || null,
      phone: newClinic.phone.trim() || null, website: newClinic.website.trim() || null,
      created_by: userId,
    }).select().single();
    if (error) { console.error('[vax-modal] add clinic:', error); setBanner({ message: error.message || 'Could not add clinic.', kind: 'error' }); return; }
    setForm((p) => ({ ...p, clinic_id: data.id, vet_clinic: data.name }));
    setShowAddClinic(false);
    setNewClinic({ name: '', address: '', phone: '', website: '' });
    setBanner({ message: 'Clinic added.', kind: 'success' });
  };

  const save = async () => {
    if (!form.vaccine.trim()) { setBanner({ message: 'Vaccine name is required.', kind: 'error' }); return; }
    setSaving(true);
    setBanner(null);

    let certificateUrl: string | null = null;
    if (form.certificate_file) {
      const ext = ((form.certificate_file as any).name || form.certificate_file.uri.split('.').pop() || 'file').split('.').pop() || 'file';
      const filePath = `${userId}/vax-cert-${Date.now()}.${ext}`;
      let upRes;
      if (Platform.OS === 'web') {
        const resp = await fetch(form.certificate_file.uri);
        const blob = await resp.blob();
        upRes = await supabase.storage.from('pet-documents').upload(filePath, blob);
      } else {
        const fd = new FormData();
        fd.append('file', { uri: form.certificate_file.uri, type: `application/octet-stream`, name: `cert.${ext}` } as any);
        upRes = await supabase.storage.from('pet-documents').upload(filePath, fd);
      }
      if (upRes.error) { console.error('[vax-modal] cert upload:', upRes.error); setBanner({ message: upRes.error.message || 'Could not upload certificate.', kind: 'error' }); setSaving(false); return; }
      certificateUrl = filePath;
    }

    const payload = {
      pet_id: petId,
      vaccine: form.vaccine.trim(),
      vaccine_type: form.vaccine_type || null,
      duration_years: form.duration_years || null,
      administered_on: form.administered_on || null,
      next_due_on: form.next_due_on || null,
      vet_clinic: form.vet_clinic.trim() || null,
      clinic_id: form.clinic_id,
      vet_name: form.vet_name.trim() || null,
      vet_license: form.vet_license.trim() || null,
      lot_number: form.lot_number.trim() || null,
      lot_expires_on: form.lot_expires_on || null,
      manufacturer: form.manufacturer.trim() || null,
      injection_site: form.injection_site.trim() || null,
      tag_number: form.tag_number.trim() || null,
      is_booster: form.is_booster,
      notes: form.notes.trim() || null,
      document_url: certificateUrl,
      recorded_by: userId,
    };

    if (editing) {
      const { error } = await supabase.from('pet_vaccinations').update(payload).eq('id', editing.id);
      if (error) { console.error('[vax-modal] update:', error); setBanner({ message: error.message || 'Could not update vaccination.', kind: 'error' }); setSaving(false); return; }
    } else {
      if (form.vaccine.trim()) {
        await supabase.from('pet_vaccinations').update({ superseded: true }).eq('pet_id', petId).eq('vaccine', form.vaccine.trim()).eq('superseded', false);
      }
      const { error } = await supabase.from('pet_vaccinations').insert(payload);
      if (error) { console.error('[vax-modal] insert:', error); setBanner({ message: error.message || 'Could not add vaccination.', kind: 'error' }); setSaving(false); return; }
    }

    setSaving(false);
    onSaved();
  };

  const filteredClinics = clinics.filter((c) => c.name.toLowerCase().includes(clinicSearch.toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ScrollView style={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>{editing ? 'Edit Vaccination' : 'Add Vaccination'}</Text>
              <TouchableOpacity onPress={onClose}><Text style={styles.closeText}>Cancel</Text></TouchableOpacity>
            </View>

            {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}

            <Text style={styles.label}>Vaccine name *</Text>
            <TextInput style={styles.input} value={form.vaccine} onChangeText={(v) => setForm((p) => ({ ...p, vaccine: v }))} placeholder="e.g. Rabies, FVRCP, DHPP" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Vaccine type</Text>
            <View style={styles.pillRow}>
              {VACCINE_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.pill, form.vaccine_type === t && styles.pillActive]} onPress={() => setForm((p) => ({ ...p, vaccine_type: t }))} activeOpacity={0.85}>
                  <Text style={[styles.pillText, form.vaccine_type === t && styles.pillTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Formulation type</Text>
            <View style={styles.pillRow}>
              {VACCINE_FORMULATION_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.pill, form.formulation_type === t && styles.pillActive]} onPress={() => setForm((p) => ({ ...p, formulation_type: t }))} activeOpacity={0.85}>
                  <Text style={[styles.pillText, form.formulation_type === t && styles.pillTextActive]}>{t === 'MLV' ? 'MLV' : t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Duration</Text>
            <View style={styles.pillRow}>
              {DURATION_OPTIONS.map((d) => (
                <TouchableOpacity key={d.label} style={[styles.pill, form.duration_years === d.years && styles.pillActive]} onPress={() => {
                  const nextDue = autoCalcNextDue(form.administered_on, d.years);
                  setForm((p) => ({ ...p, duration_years: d.years, next_due_on: p.next_due_locked ? p.next_due_on : nextDue }));
                }} activeOpacity={0.85}>
                  <Text style={[styles.pillText, form.duration_years === d.years && styles.pillTextActive]}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Date given (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={form.administered_on} onChangeText={(v) => {
              const nextDue = form.next_due_locked ? form.next_due_on : autoCalcNextDue(v, form.duration_years);
              setForm((p) => ({ ...p, administered_on: v, next_due_on: nextDue }));
            }} placeholder="2025-01-15" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Next due (auto-calculated, editable)</Text>
            <TextInput style={styles.input} value={form.next_due_on} onChangeText={(v) => setForm((p) => ({ ...p, next_due_on: v, next_due_locked: true }))} placeholder="2026-01-15" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Clinic</Text>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setShowClinicPicker(true)} activeOpacity={0.85}>
              <Text style={form.vet_clinic ? styles.dropdownText : styles.dropdownPlaceholder}>{form.vet_clinic || 'Search clinics...'}</Text>
              <ChevronDown color={Colors.textTertiary} size={18} />
            </TouchableOpacity>

            <Text style={styles.label}>Vet name</Text>
            <TextInput style={styles.input} value={form.vet_name} onChangeText={(v) => setForm((p) => ({ ...p, vet_name: v }))} placeholder="Dr. Smith" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Vet license #</Text>
            <TextInput style={styles.input} value={form.vet_license} onChangeText={(v) => setForm((p) => ({ ...p, vet_license: v }))} placeholder="License number" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Lot number</Text>
            <TextInput style={styles.input} value={form.lot_number} onChangeText={(v) => setForm((p) => ({ ...p, lot_number: v }))} placeholder="Lot #" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Lot expiry (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={form.lot_expires_on} onChangeText={(v) => setForm((p) => ({ ...p, lot_expires_on: v }))} placeholder="2026-12-31" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Manufacturer</Text>
            <TextInput style={styles.input} value={form.manufacturer} onChangeText={(v) => setForm((p) => ({ ...p, manufacturer: v }))} placeholder="e.g. Zoetis, Boehringer Ingelheim" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Injection site</Text>
            <TextInput style={styles.input} value={form.injection_site} onChangeText={(v) => setForm((p) => ({ ...p, injection_site: v }))} placeholder="e.g. Right shoulder, Left flank" placeholderTextColor={Colors.textTertiary} />

            <Text style={styles.label}>Tag number</Text>
            <TextInput style={styles.input} value={form.tag_number} onChangeText={(v) => setForm((p) => ({ ...p, tag_number: v }))} placeholder="Rabies tag #" placeholderTextColor={Colors.textTertiary} />

            <TouchableOpacity style={styles.toggleRow} onPress={() => setForm((p) => ({ ...p, is_booster: !p.is_booster }))} activeOpacity={0.85}>
              <View style={[styles.checkbox, form.is_booster && styles.checkboxActive]}>
                {form.is_booster && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.toggleText}>Booster</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} value={form.notes} onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))} placeholder="Additional notes" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={3} />

            <Text style={styles.label}>Certificate upload</Text>
            <TouchableOpacity style={styles.fileBtn} onPress={pickCertificate} activeOpacity={0.85}>
              <FileText color={Colors.navy} size={18} />
              <Text style={styles.fileText}>{form.certificate_file ? 'File selected' : 'Choose certificate (PDF/image)...'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.submitBtn, saving && styles.btnDisabled]} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.submitText}>{editing ? 'Save Changes' : 'Add Vaccination'}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <Modal visible={showClinicPicker} animationType="fade" transparent onRequestClose={() => setShowClinicPicker(false)}>
        <View style={styles.overlay}>
          <View style={styles.searchCard}>
            <View style={styles.searchHeader}>
              <TextInput style={styles.searchInput} value={clinicSearch} onChangeText={setClinicSearch} placeholder="Search clinics..." placeholderTextColor={Colors.textTertiary} autoFocus />
              <TouchableOpacity onPress={() => setShowClinicPicker(false)}><X color={Colors.textTertiary} size={22} /></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.addClinicRow} onPress={() => { setShowClinicPicker(false); setShowAddClinic(true); }} activeOpacity={0.85}>
              <Plus color={Colors.coral} size={18} />
              <Text style={styles.addClinicText}>Add new clinic</Text>
            </TouchableOpacity>
            <FlatList data={filteredClinics} keyExtractor={(item) => item.id} renderItem={({ item }) => (
              <TouchableOpacity style={styles.searchResultRow} onPress={() => { setForm((p) => ({ ...p, clinic_id: item.id, vet_clinic: item.name })); setShowClinicPicker(false); }} activeOpacity={0.85}>
                <Text style={styles.searchResultText}>{item.name}</Text>
                {item.address ? <Text style={styles.searchResultSub}>{item.address}</Text> : null}
              </TouchableOpacity>
            )} style={{ maxHeight: 350 }} />
          </View>
        </View>
      </Modal>

      <Modal visible={showAddClinic} animationType="fade" transparent onRequestClose={() => setShowAddClinic(false)}>
        <View style={styles.overlay}>
          <View style={styles.addClinicCard}>
            <View style={styles.header}>
              <Text style={styles.title}>Add New Clinic</Text>
              <TouchableOpacity onPress={() => setShowAddClinic(false)}><X color={Colors.textTertiary} size={22} /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Clinic name *</Text>
            <TextInput style={styles.input} value={newClinic.name} onChangeText={(v) => setNewClinic((p) => ({ ...p, name: v }))} placeholder="Riverside Animal Hospital" placeholderTextColor={Colors.textTertiary} />
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={newClinic.address} onChangeText={(v) => setNewClinic((p) => ({ ...p, address: v }))} placeholder="123 Main St, City, ST" placeholderTextColor={Colors.textTertiary} />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={newClinic.phone} onChangeText={(v) => setNewClinic((p) => ({ ...p, phone: v }))} placeholder="(555) 123-4567" placeholderTextColor={Colors.textTertiary} keyboardType="phone-pad" />
            <Text style={styles.label}>Website</Text>
            <TextInput style={styles.input} value={newClinic.website} onChangeText={(v) => setNewClinic((p) => ({ ...p, website: v }))} placeholder="https://..." placeholderTextColor={Colors.textTertiary} />
            <TouchableOpacity style={styles.submitBtn} onPress={addNewClinic} activeOpacity={0.85}>
              <Text style={styles.submitText}>Add Clinic</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConfirmDialog config={confirmConfig} onClose={() => setConfirmConfig(null)} />
    </Modal>
  );
}

export function VaccinationCard({
  vax, canEdit, onEdit, onDelete,
}: {
  vax: Vaccination; canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const status = vaccinationStatus(vax.next_due_on);
  const [showHistory, setShowHistory] = useState(false);
  const cert = useSignedUrl(vax.document_url);

  return (
    <View style={[styles.vaxCard, status === 'overdue' && styles.vaxCardOverdue, status === 'due-soon' && styles.vaxCardDueSoon, vax.superseded && styles.vaxCardSuperseded]}>
      <View style={styles.vaxTopRow}>
        <Text style={styles.vaxName}>{vax.vaccine}</Text>
        {vax.is_booster && <Text style={styles.boosterTag}>Booster</Text>}
        {status === 'overdue' && (
          <View style={[styles.vaxStatusPill, { backgroundColor: Colors.criticalBg }]}>
            <CircleAlert color={Colors.critical} size={12} />
            <Text style={[styles.vaxStatusText, { color: Colors.critical }]}>Overdue</Text>
          </View>
        )}
        {status === 'due-soon' && (
          <View style={[styles.vaxStatusPill, { backgroundColor: Colors.urgentBg }]}>
            <Clock color={Colors.urgent} size={12} />
            <Text style={[styles.vaxStatusText, { color: Colors.urgent }]}>Due soon</Text>
          </View>
        )}
        {status === 'ok' && (
          <View style={[styles.vaxStatusPill, { backgroundColor: Colors.tealBg }]}>
            <CheckCircle color={Colors.tealDark} size={12} />
            <Text style={[styles.vaxStatusText, { color: Colors.tealDark }]}>Valid through {formatDate(vax.next_due_on)}</Text>
          </View>
        )}
      </View>
      <Text style={styles.vaxDetail}>Given: {formatDate(vax.administered_on)}</Text>
      <Text style={styles.vaxDetail}>Next due: {formatDate(vax.next_due_on)}</Text>
      {vax.vet_clinic ? <Text style={styles.vaxDetail}>Clinic: {vax.vet_clinic}</Text> : null}
      {vax.vet_name ? <Text style={styles.vaxDetail}>Vet: {vax.vet_name}</Text> : null}
      {vax.lot_number ? <Text style={styles.vaxDetail}>Lot: {vax.lot_number}{vax.lot_expires_on ? ` (expires ${formatDate(vax.lot_expires_on)})` : ''}</Text> : null}
      {vax.manufacturer ? <Text style={styles.vaxDetail}>Mfr: {vax.manufacturer}</Text> : null}
      {vax.injection_site ? <Text style={styles.vaxDetail}>Site: {vax.injection_site}</Text> : null}
      {vax.tag_number ? <Text style={styles.vaxDetail}>Tag: {vax.tag_number}</Text> : null}
      {vax.vet_license ? <Text style={styles.vaxDetail}>Vet license: {vax.vet_license}</Text> : null}
      {vax.notes ? <Text style={styles.vaxNotes}>{vax.notes}</Text> : null}
      {vax.document_url ? (
        cert.loading ? (
          <View style={styles.certLink}><ActivityIndicator size="small" color={Colors.navy} /></View>
        ) : cert.error || !cert.url ? (
          <View style={styles.certLink}>
            <FileText color={Colors.critical || '#EF4444'} size={14} />
            <Text style={[styles.certLinkText, { color: Colors.critical || '#EF4444' }]}>Certificate unavailable</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={() => { if (Platform.OS === 'web') window.open(cert.url!, '_blank'); else Linking.openURL(cert.url!); }} style={styles.certLink}>
            <FileText color={Colors.navy} size={14} />
            <Text style={styles.certLinkText}>View certificate</Text>
          </TouchableOpacity>
        )
      ) : null}
      {canEdit && (
        <View style={styles.vaxActions}>
          <TouchableOpacity style={styles.vaxEditBtn} onPress={onEdit} activeOpacity={0.85}>
            <Text style={styles.vaxEditText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.vaxDeleteBtn} onPress={onDelete} activeOpacity={0.85}>
            <Trash2 color={Colors.critical} size={14} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  scroll: { maxHeight: '88%' },
  card: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text },
  closeText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.coral },
  label: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.surface },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  pillTextActive: { color: Colors.white },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: Colors.surface },
  dropdownText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text },
  dropdownPlaceholder: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textTertiary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.borderInput, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  checkmark: { color: Colors.white, fontSize: 14, fontFamily: Fonts.bold },
  toggleText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  fileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: Colors.surface },
  fileText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary },
  submitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  submitText: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.white },
  btnDisabled: { opacity: 0.6 },
  searchCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text },
  addClinicRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  addClinicText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.coral },
  searchResultRow: { paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchResultText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text },
  searchResultSub: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  addClinicCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  vaxCard: { backgroundColor: Colors.white, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  vaxCardOverdue: { borderColor: Colors.critical, borderWidth: 1.5 },
  vaxCardDueSoon: { borderColor: Colors.urgent, borderWidth: 1.5 },
  vaxCardSuperseded: { opacity: 0.55 },
  vaxTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  vaxName: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text, flex: 1 },
  boosterTag: { fontSize: FontSizes.xs, fontFamily: Fonts.bold, color: Colors.navy, backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 6 },
  vaxStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  vaxStatusText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold },
  vaxDetail: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  vaxNotes: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textBody, marginTop: 4, lineHeight: 20 },
  certLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  certLinkText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
  vaxActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  vaxEditBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.surface },
  vaxEditText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
  vaxDeleteBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: Colors.critical },
});
