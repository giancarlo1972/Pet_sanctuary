import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, FlatList, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { X, Plus, FlaskConical, Trash2, FileText, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { InlineBanner } from '@/components/InlineBanner';
import { ConfirmDialog, type ConfirmConfig } from '@/components/ConfirmDialog';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { supabase } from '@/lib/supabase';
import { extFromAsset } from '@/lib/storage';
import { useSignedUrl } from '@/hooks/useSignedUrls';

export interface LabPanel {
  id: string;
  pet_id: string;
  panel_name: string;
  collected_on: string;
  clinic_id: string | null;
  vet_name: string | null;
  document_url: string | null;
  notes: string | null;
  results: LabResult[];
}

export interface LabResult {
  id: string;
  panel_id: string;
  analyte: string;
  value_numeric: number | null;
  value_text: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  flag: string | null;
}

export interface VetClinicLite {
  id: string;
  name: string;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const FLAG_COLORS: Record<string, string> = {
  H: Colors.critical, L: Colors.urgent, '*': Colors.critical, 'H*': Colors.critical, 'L*': Colors.urgent,
};

function LabDocLink({ path }: { path: string }) {
  const { url, loading, error } = useSignedUrl(path);
  if (loading) return <View style={styles.docLink}><ActivityIndicator size="small" color={Colors.navy} /></View>;
  if (error || !url) {
    return (
      <View style={styles.docLink}>
        <FileText color={Colors.critical || '#EF4444'} size={14} />
        <Text style={[styles.docLinkText, { color: Colors.critical || '#EF4444' }]}>Document unavailable</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.docLink} onPress={() => { if (Platform.OS === 'web') window.open(url, '_blank'); else Linking.openURL(url); }}>
      <FileText color={Colors.navy} size={14} />
      <Text style={styles.docLinkText}>View document</Text>
    </TouchableOpacity>
  );
}

export function VetLabResults({
  petId, userId, clinics, canEdit,
}: {
  petId: string; userId: string; clinics: VetClinicLite[]; canEdit: boolean;
}) {
  const [panels, setPanels] = useState<LabPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ message: string; kind: 'error' | 'success' | 'info' } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [trendAnalyte, setTrendAnalyte] = useState<string | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());

  const [panelForm, setPanelForm] = useState({
    panel_name: '', collected_on: '', clinic_id: '' as string | null, vet_name: '', notes: '',
  });
  const [resultRows, setResultRows] = useState<LabResultDraft[]>([]);
  const [docFile, setDocFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  interface LabResultDraft {
    analyte: string; value_numeric: string; value_text: string; unit: string;
    ref_low: string; ref_high: string; ref_text: string; flag: string;
  }

  const emptyRow: LabResultDraft = { analyte: '', value_numeric: '', value_text: '', unit: '', ref_low: '', ref_high: '', ref_text: '', flag: '' };

  const load = useCallback(async () => {
    if (!petId) return;
    setLoading(true);
    const { data: panelData, error } = await supabase
      .from('lab_panels')
      .select('id, pet_id, panel_name, collected_on, clinic_id, vet_name, document_url, notes')
      .eq('pet_id', petId)
      .order('collected_on', { ascending: false });
    if (error) { console.error('[lab-results] load panels:', error); setBanner({ message: 'Could not load lab results.', kind: 'error' }); setLoading(false); return; }

    const panelIds = (panelData || []).map((p) => p.id);
    let results: LabResult[] = [];
    if (panelIds.length > 0) {
      const { data: resData, error: resErr } = await supabase
        .from('lab_results')
        .select('id, panel_id, analyte, value_numeric, value_text, unit, ref_low, ref_high, ref_text, flag')
        .in('panel_id', panelIds);
      if (resErr) { console.error('[lab-results] load results:', resErr); }
      results = (resData as LabResult[]) || [];
    }

    const panelsWithResults: LabPanel[] = (panelData || []).map((p) => ({
      ...p, results: results.filter((r) => r.panel_id === p.id),
    }));
    setPanels(panelsWithResults);
    setLoading(false);
  }, [petId]);

  useEffect(() => { load(); }, [load]);

  const openAddPanel = () => {
    setPanelForm({ panel_name: '', collected_on: new Date().toISOString().slice(0, 10), clinic_id: null, vet_name: '', notes: '' });
    setResultRows([{ ...emptyRow }, { ...emptyRow }, { ...emptyRow }]);
    setDocFile(null);
    setBanner(null);
    setModalVisible(true);
  };

  const pickDoc = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,application/pdf';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) setDocFile({ uri: URL.createObjectURL(file), name: file.name, mimeType: file.type } as any);
      };
      input.click();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) setDocFile(result.assets[0]);
  };

  const savePanel = async () => {
    if (!panelForm.panel_name.trim()) { setBanner({ message: 'Panel name is required.', kind: 'error' }); return; }
    setSaving(true);
    setBanner(null);

    let docUrl: string | null = null;
    if (docFile) {
      const ext = extFromAsset(docFile as any);
      const filePath = `${userId}/lab-${Date.now()}.${ext}`;
      let upRes;
      if (Platform.OS === 'web') {
        const resp = await fetch(docFile.uri);
        const blob = await resp.blob();
        upRes = await supabase.storage.from('pet-documents').upload(filePath, blob);
      } else {
        const fd = new FormData();
        fd.append('file', { uri: docFile.uri, type: 'application/octet-stream', name: `doc.${ext}` } as any);
        upRes = await supabase.storage.from('pet-documents').upload(filePath, fd);
      }
      if (upRes.error) { console.error('[lab-results] doc upload:', upRes.error); setBanner({ message: 'Could not upload document.', kind: 'error' }); setSaving(false); return; }
      docUrl = filePath;
    }

    const { data: panelRow, error: panelErr } = await supabase.from('lab_panels').insert({
      pet_id: petId,
      panel_name: panelForm.panel_name.trim(),
      collected_on: panelForm.collected_on || null,
      clinic_id: panelForm.clinic_id || null,
      vet_name: panelForm.vet_name.trim() || null,
      document_url: docUrl,
      notes: panelForm.notes.trim() || null,
      recorded_by: userId,
    }).select().single();

    if (panelErr) { console.error('[lab-results] panel insert:', panelErr); setBanner({ message: panelErr.message || 'Could not save panel.', kind: 'error' }); setSaving(false); return; }

    const validRows = resultRows.filter((r) => r.analyte.trim());
    if (validRows.length > 0) {
      const resultPayload = validRows.map((r) => ({
        panel_id: panelRow.id,
        analyte: r.analyte.trim(),
        value_numeric: r.value_numeric ? parseFloat(r.value_numeric) : null,
        value_text: r.value_text.trim() || null,
        unit: r.unit.trim() || null,
        ref_low: r.ref_low ? parseFloat(r.ref_low) : null,
        ref_high: r.ref_high ? parseFloat(r.ref_high) : null,
        ref_text: r.ref_text.trim() || null,
        flag: r.flag.trim() || null,
      }));
      const { error: resErr } = await supabase.from('lab_results').insert(resultPayload);
      if (resErr) { console.error('[lab-results] results insert:', resErr); setBanner({ message: 'Panel saved but some results could not be stored.', kind: 'error' }); }
    }

    setSaving(false);
    setModalVisible(false);
    load();
  };

  const deletePanel = (panelId: string) => {
    setConfirmConfig({
      title: 'Delete lab panel?',
      message: 'This will delete the panel and all its result rows. This cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
      onConfirm: async () => {
        const { error } = await supabase.from('lab_panels').delete().eq('id', panelId);
        if (error) { console.error('[lab-results] delete:', error); setBanner({ message: 'Could not delete panel.', kind: 'error' }); return; }
        load();
      },
    });
  };

  const togglePanel = (panelId: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panelId)) next.delete(panelId); else next.add(panelId);
      return next;
    });
  };

  const allNumericByAnalyte: Record<string, { date: string; value: number; unit: string }[]> = {};
  panels.forEach((p) => {
    p.results.forEach((r) => {
      if (r.value_numeric != null) {
        if (!allNumericByAnalyte[r.analyte]) allNumericByAnalyte[r.analyte] = [];
        allNumericByAnalyte[r.analyte].push({ date: p.collected_on, value: r.value_numeric, unit: r.unit || '' });
      }
    });
  });
  const trendData = trendAnalyte ? allNumericByAnalyte[trendAnalyte] || [] : [];

  return (
    <View>
      {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}

      <View style={styles.subHeader}>
        <View style={styles.subHeaderLeft}>
          <FlaskConical color={Colors.navy} size={18} />
          <Text style={styles.subHeaderText}>Lab Results</Text>
        </View>
        {canEdit && (
          <TouchableOpacity style={styles.addBtn} onPress={openAddPanel} activeOpacity={0.85}>
            <Plus color={Colors.coral} size={16} />
            <Text style={styles.addBtnText}>Add Panel</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={Colors.coral} style={{ paddingVertical: 20 }} />
      ) : panels.length === 0 ? (
        <Text style={styles.emptyText}>No lab results recorded.</Text>
      ) : (
        panels.map((panel) => {
          const expanded = expandedPanels.has(panel.id);
          return (
            <View key={panel.id} style={styles.panelCard}>
              <TouchableOpacity style={styles.panelHeader} onPress={() => togglePanel(panel.id)} activeOpacity={0.85}>
                <View style={styles.panelHeaderLeft}>
                  <Text style={styles.panelName}>{panel.panel_name}</Text>
                  <Text style={styles.panelDate}>{formatDate(panel.collected_on)}</Text>
                  {panel.vet_name ? <Text style={styles.panelSub}>Vet: {panel.vet_name}</Text> : null}
                </View>
                {expanded ? <ChevronUp color={Colors.textTertiary} size={18} /> : <ChevronDown color={Colors.textTertiary} size={18} />}
              </TouchableOpacity>

              {expanded && (
                <View style={styles.panelBody}>
                  {panel.document_url && (
                    <LabDocLink path={panel.document_url} />
                  )}
                  {panel.notes ? <Text style={styles.panelNotes}>{panel.notes}</Text> : null}

                  {panel.results.length === 0 ? (
                    <Text style={styles.emptyText}>No result rows in this panel.</Text>
                  ) : (
                    panel.results.map((r) => {
                      const flagColor = r.flag ? (FLAG_COLORS[r.flag.toUpperCase()] || Colors.critical) : null;
                      return (
                        <View key={r.id} style={styles.resultRow}>
                          <Text style={styles.resultAnalyte}>{r.analyte}</Text>
                          <View style={styles.resultValueWrap}>
                            {r.value_numeric != null ? (
                              <Text style={styles.resultValue}>{r.value_numeric}{r.unit ? ` ${r.unit}` : ''}</Text>
                            ) : r.value_text ? (
                              <Text style={styles.resultValue}>{r.value_text}</Text>
                            ) : (
                              <Text style={styles.resultValue}>—</Text>
                            )}
                            {r.flag && (
                              <View style={[styles.flagPill, { backgroundColor: (flagColor || Colors.critical) + '20' }]}>
                                <Text style={[styles.flagText, { color: flagColor || Colors.critical }]}>{r.flag}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.resultRef}>
                            {r.ref_low != null && r.ref_high != null
                              ? `${r.ref_low}–${r.ref_high}${r.unit ? ` ${r.unit}` : ''}`
                              : r.ref_text || ''}
                          </Text>
                          {r.value_numeric != null && (
                            <TouchableOpacity onPress={() => setTrendAnalyte(r.analyte)} style={styles.trendBtn}>
                              <TrendingUp color={Colors.navy} size={14} />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })
                  )}

                  {canEdit && (
                    <TouchableOpacity style={styles.deletePanelBtn} onPress={() => deletePanel(panel.id)} activeOpacity={0.85}>
                      <Trash2 color={Colors.critical} size={14} />
                      <Text style={styles.deletePanelText}>Delete panel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}

      {trendAnalyte && trendData.length > 0 && (
        <Modal visible animationType="fade" transparent onRequestClose={() => setTrendAnalyte(null)}>
          <View style={styles.trendOverlay}>
            <View style={styles.trendCard}>
              <View style={styles.trendHeader}>
                <Text style={styles.trendTitle}>{trendAnalyte} over time</Text>
                <TouchableOpacity onPress={() => setTrendAnalyte(null)}><X color={Colors.textTertiary} size={22} /></TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 400 }}>
                {trendData.map((point, i) => (
                  <View key={i} style={styles.trendRow}>
                    <Text style={styles.trendDate}>{formatDate(point.date)}</Text>
                    <Text style={styles.trendValue}>{point.value} {point.unit}</Text>
                  </View>
                ))}
              </ScrollView>
              <Text style={styles.trendDisclaimer}>Values are shown as reported by the lab. No interpretation is provided.</Text>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Lab Panel</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.modalCloseText}>Cancel</Text></TouchableOpacity>
              </View>

              {banner && <InlineBanner message={banner.message} kind={banner.kind} onDismiss={() => setBanner(null)} />}

              <Text style={styles.modalLabel}>Panel name *</Text>
              <TextInput style={styles.modalInput} value={panelForm.panel_name} onChangeText={(v) => setPanelForm((p) => ({ ...p, panel_name: v }))} placeholder="e.g. CBC, Chemistry Panel, FeLV/FIV" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.modalLabel}>Date collected (YYYY-MM-DD)</Text>
              <TextInput style={styles.modalInput} value={panelForm.collected_on} onChangeText={(v) => setPanelForm((p) => ({ ...p, collected_on: v }))} placeholder="2025-01-15" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.modalLabel}>Clinic</Text>
              <View style={styles.pillRow}>
                {clinics.map((c) => (
                  <TouchableOpacity key={c.id} style={[styles.pill, panelForm.clinic_id === c.id && styles.pillActive]} onPress={() => setPanelForm((p) => ({ ...p, clinic_id: c.id }))} activeOpacity={0.85}>
                    <Text style={[styles.pillText, panelForm.clinic_id === c.id && styles.pillTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Vet name</Text>
              <TextInput style={styles.modalInput} value={panelForm.vet_name} onChangeText={(v) => setPanelForm((p) => ({ ...p, vet_name: v }))} placeholder="Dr. Smith" placeholderTextColor={Colors.textTertiary} />

              <Text style={styles.modalLabel}>Document (optional)</Text>
              <TouchableOpacity style={styles.fileBtn} onPress={pickDoc} activeOpacity={0.85}>
                <FileText color={Colors.navy} size={18} />
                <Text style={styles.fileText}>{docFile ? 'File selected' : 'Choose file...'}</Text>
              </TouchableOpacity>

              <Text style={styles.modalLabel}>Result rows</Text>
              <Text style={styles.helperText}>Enter each analyte on its own row. Use value_text for non-numeric results (e.g. "Negative"). Reference ranges and flags come from the lab report.</Text>
              {resultRows.map((row, i) => (
                <View key={i} style={styles.resultFormRow}>
                  <TextInput style={[styles.modalInput, styles.resultInput]} value={row.analyte} onChangeText={(v) => setResultRows((prev) => { const n = [...prev]; n[i] = { ...n[i], analyte: v }; return n; })} placeholder="Analyte" placeholderTextColor={Colors.textTertiary} />
                  <TextInput style={[styles.modalInput, styles.resultInputSmall]} value={row.value_numeric} onChangeText={(v) => setResultRows((prev) => { const n = [...prev]; n[i] = { ...n[i], value_numeric: v }; return n; })} placeholder="Value" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
                  <TextInput style={[styles.modalInput, styles.resultInputSmall]} value={row.value_text} onChangeText={(v) => setResultRows((prev) => { const n = [...prev]; n[i] = { ...n[i], value_text: v }; return n; })} placeholder="Text" placeholderTextColor={Colors.textTertiary} />
                  <TextInput style={[styles.modalInput, styles.resultInputSmall]} value={row.unit} onChangeText={(v) => setResultRows((prev) => { const n = [...prev]; n[i] = { ...n[i], unit: v }; return n; })} placeholder="Unit" placeholderTextColor={Colors.textTertiary} />
                  <TextInput style={[styles.modalInput, styles.resultInputSmall]} value={row.ref_low} onChangeText={(v) => setResultRows((prev) => { const n = [...prev]; n[i] = { ...n[i], ref_low: v }; return n; })} placeholder="Ref low" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
                  <TextInput style={[styles.modalInput, styles.resultInputSmall]} value={row.ref_high} onChangeText={(v) => setResultRows((prev) => { const n = [...prev]; n[i] = { ...n[i], ref_high: v }; return n; })} placeholder="Ref high" placeholderTextColor={Colors.textTertiary} keyboardType="numeric" />
                  <TextInput style={[styles.modalInput, styles.resultInputSmall]} value={row.ref_text} onChangeText={(v) => setResultRows((prev) => { const n = [...prev]; n[i] = { ...n[i], ref_text: v }; return n; })} placeholder="Ref text" placeholderTextColor={Colors.textTertiary} />
                  <TextInput style={[styles.modalInput, styles.resultInputSmall]} value={row.flag} onChangeText={(v) => setResultRows((prev) => { const n = [...prev]; n[i] = { ...n[i], flag: v }; return n; })} placeholder="Flag" placeholderTextColor={Colors.textTertiary} />
                </View>
              ))}
              <TouchableOpacity style={styles.addRowBtn} onPress={() => setResultRows((prev) => [...prev, { ...emptyRow }])} activeOpacity={0.85}>
                <Plus color={Colors.coral} size={16} />
                <Text style={styles.addRowText}>Add row</Text>
              </TouchableOpacity>

              <Text style={styles.modalLabel}>Notes</Text>
              <TextInput style={[styles.modalInput, styles.modalInputMultiline]} value={panelForm.notes} onChangeText={(v) => setPanelForm((p) => ({ ...p, notes: v }))} placeholder="Panel notes" placeholderTextColor={Colors.textTertiary} multiline numberOfLines={2} />

              <TouchableOpacity style={[styles.modalSubmitBtn, saving && styles.btnDisabled]} onPress={savePanel} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator size="small" color={Colors.white} /> : <Text style={styles.modalSubmitText}>Save Panel</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.surface },
  addBtnText: { fontSize: FontSizes.sm, fontFamily: Fonts.bold, color: Colors.coral },
  emptyText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
  panelCard: { backgroundColor: Colors.white, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  panelHeaderLeft: { flex: 1 },
  panelName: { fontSize: FontSizes.md, fontFamily: Fonts.bold, color: Colors.text },
  panelDate: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 2 },
  panelSub: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, marginTop: 1 },
  panelBody: { padding: 14, paddingTop: 0, gap: 8 },
  panelNotes: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textBody, lineHeight: 20, marginBottom: 8 },
  docLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  docLinkText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 8 },
  resultAnalyte: { flex: 1, fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.text },
  resultValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultValue: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.text },
  flagPill: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  flagText: { fontSize: FontSizes.xs, fontFamily: Fonts.bold },
  resultRef: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary, width: 100, textAlign: 'right' },
  trendBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  deletePanelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, paddingVertical: 8 },
  deletePanelText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.critical },
  trendOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  trendCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
  trendHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  trendTitle: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.text },
  trendRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  trendDate: { fontSize: FontSizes.sm, fontFamily: Fonts.regular, color: Colors.textSecondary },
  trendValue: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.text },
  trendDisclaimer: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 12, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '88%' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: FontSizes.xl, fontFamily: Fonts.bold, color: Colors.text },
  modalCloseText: { fontSize: FontSizes.md, fontFamily: Fonts.semibold, color: Colors.coral },
  modalLabel: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy, marginBottom: 6, marginTop: 12 },
  modalInput: { borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.text, backgroundColor: Colors.surface },
  modalInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  helperText: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary, marginBottom: 8, lineHeight: 16 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.navy, borderColor: Colors.navy },
  pillText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  pillTextActive: { color: Colors.white },
  fileBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.borderInput, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: Colors.surface },
  fileText: { fontSize: FontSizes.md, fontFamily: Fonts.regular, color: Colors.textSecondary },
  resultFormRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  resultInput: { flex: 1, minWidth: 100 },
  resultInputSmall: { width: 80 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10 },
  addRowText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.coral },
  modalSubmitBtn: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  modalSubmitText: { fontSize: FontSizes.lg, fontFamily: Fonts.bold, color: Colors.white },
  btnDisabled: { opacity: 0.6 },
});
