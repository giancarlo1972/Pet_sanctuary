import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Download } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Fonts, FontSizes } from '@/constants/Fonts';
import { vaccineType } from '@/lib/catalog';

function dash(s: string) {
  return s.replace(/[—–]/g, '-');
}

function fmt(iso?: string | null) {
  if (!iso) return '-';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso).slice(0, 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function kgToLb(kg: number) {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export type VaxRow = {
  vaccine: string;
  administered_on: string | null;
  next_due_on: string | null;
  lot_number: string | null;
  manufacturer: string | null;
  vet_clinic: string | null;
  vet_name: string | null;
  superseded?: boolean | null;
};

export interface SummaryData {
  pet: {
    name: string | null;
    species: string | null;
    breed: string;
    gender: string | null;
    date_of_birth: string | null;
    microchipped: boolean | null;
    spayed_neutered: boolean | null;
    weight_lb?: number | null;
    weight_kg?: number | null;
    body_condition_score: number | null;
    target_weight_lb?: number | null;
    target_weight_kg?: number | null;
    previous_names: string[] | null;
    weight_unit?: 'lb' | 'kg';
  };
  vaccinations: VaxRow[];
  conditions: {
    kind: string;
    name: string;
    severity: string | null;
    diagnosed_on: string | null;
    is_active: boolean;
  }[];
  lastExam?: {
    visit_date?: string | null;
    clinic?: string | null;
    vitals?: { temp_f?: number | null; hr?: number | null; rr?: number | null; bcs?: number | null; pain?: number | null; hydration?: string | null } | null;
  } | null;
  meds?: { name: string; dose?: string | null; route?: string | null; administered_on?: string | null; status?: string | null }[];
  labs?: { analyte?: string; name?: string; value?: any; value_text?: string | null; unit?: string | null; flag?: string | null; collected_on?: string | null }[];
  labPanels?: any[];
  clinics?: any[];
}

function groupVaccines(rows: VaxRow[]) {
  const doses = rows.filter((v) => v.administered_on);
  const map = new Map<string, VaxRow[]>();
  for (const v of doses) {
    const t = vaccineType(v.vaccine);
    if (!map.has(t)) map.set(t, []);
    map.get(t)!.push(v);
  }
  return [...map.entries()].map(([type, list]) => {
    const sorted = list.slice().sort((a, b) => String(b.administered_on).localeCompare(String(a.administered_on)));
    return { type, current: sorted[0], prior: sorted.slice(1) };
  });
}

function vaxStatus(due?: string | null) {
  if (!due) return 'current';
  return due < todayIso() ? 'overdue' : 'current';
}

export function generateVetSummaryText(data: SummaryData): string {
  const unit = data.pet.weight_unit || 'lb';
  const lb = data.pet.weight_lb ?? (data.pet.weight_kg != null ? kgToLb(data.pet.weight_kg) : null);
  const target = data.pet.target_weight_lb ?? (data.pet.target_weight_kg != null ? kgToLb(data.pet.target_weight_kg) : null);
  const bcs = data.lastExam?.vitals?.bcs ?? data.pet.body_condition_score;
  const lines: string[] = [];
  lines.push('RESCUE ARMY - VET SUMMARY');
  lines.push('=========================');
  lines.push('');
  const pet = data.pet;
  lines.push(`Name: ${pet.name || '-'}`);
  lines.push(`Species: ${pet.species || '-'}`);
  lines.push(`Breed: ${pet.breed || '-'}`);
  lines.push(`Sex: ${pet.gender || '-'}`);
  lines.push(`Date of Birth: ${fmt(pet.date_of_birth)}`);
  lines.push(`Microchipped: ${pet.microchipped ? 'Yes' : 'No'}`);
  lines.push(`Spayed/Neutered: ${pet.spayed_neutered ? 'Yes' : 'No'}`);
  lines.push(`Weight: ${lb != null ? `${lb} ${unit}` : '-'}`);
  lines.push(`Body Condition Score: ${bcs != null ? `${bcs}/9` : '-'}`);
  lines.push(`Target Weight: ${target != null ? `${target} ${unit}` : '-'}`);
  if (pet.previous_names?.length) lines.push(`Previous Names: ${pet.previous_names.join(', ')}`);
  lines.push('');

  lines.push('VACCINATIONS');
  lines.push('------------');
  const groups = groupVaccines(data.vaccinations);
  if (!groups.length) lines.push('(none)');
  for (const g of groups) {
    const c = g.current;
    const status = vaxStatus(c.next_due_on);
    const product = c.vaccine;
    let line = `${g.type} (${product}) - ${status}. Given ${fmt(c.administered_on)}, due ${fmt(c.next_due_on)}.`;
    if (g.prior.length) {
      line += ' Prior: ' + g.prior.map((p) => `${fmt(p.administered_on)} (${[p.vet_clinic, p.lot_number ? `lot ${p.lot_number}` : ''].filter(Boolean).join(', ') || '-'})`).join('; ');
    }
    lines.push(line);
  }
  lines.push('');

  const exam = data.lastExam;
  lines.push('LAST EXAM');
  lines.push('---------');
  if (!exam) lines.push('(none)');
  else {
    lines.push(`${fmt(exam.visit_date || null)} - ${exam.clinic || 'Clinic'}`);
    const v = exam.vitals || {};
    lines.push(`Vitals: Temp ${v.temp_f ?? '-'} F, HR ${v.hr ?? '-'}, RR ${v.rr ?? '-'}, BCS ${v.bcs ?? '-'}, Pain ${v.pain ?? '-'}, Hydration ${v.hydration || '-'}`);
  }
  lines.push('');

  lines.push('ACTIVE CONDITIONS');
  lines.push('-----------------');
  const active = data.conditions.filter((c) => c.is_active !== false);
  if (!active.length) lines.push('(none)');
  active.forEach((c) => lines.push(`- ${c.name}${c.severity ? ` (${c.severity})` : ''}${c.diagnosed_on ? ` - since ${fmt(c.diagnosed_on)}` : ''}`));
  lines.push('');

  lines.push('CURRENT MEDICATIONS');
  lines.push('-------------------');
  const meds = (data.meds || []).filter((m) => (m.status || 'active') !== 'completed');
  if (!meds.length) lines.push('(none)');
  meds.forEach((m) => lines.push(`- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.route ? ` ${m.route}` : ''}${m.administered_on ? ` - last ${fmt(m.administered_on)}` : ''}`));
  lines.push('');

  lines.push('ABNORMAL LABS');
  lines.push('-------------');
  const labs = (data.labs || []).filter((l) => /high|low|abnormal/i.test(String(l.flag || '')));
  if (!labs.length) lines.push('(none)');
  labs.forEach((l) => {
    const name = l.analyte || l.name || 'Lab';
    lines.push(`- ${name}: ${l.value ?? l.value_text ?? '-'} ${l.unit || ''} (${l.flag}) ${fmt(l.collected_on || null)}`.replace(/\s+/g, ' ').trim());
  });
  lines.push('');
  lines.push('Generated by Rescue Army. This is not a veterinary diagnosis.');
  return dash(lines.join('\n'));
}

function generateHtml(data: SummaryData) {
  const text = generateVetSummaryText(data);
  const blocks = text.split('\n').map((line) => {
    if (/^[A-Z][A-Z /]+$/.test(line) || line.startsWith('====') || line.startsWith('----')) {
      return `<h2 style="font-family:system-ui,sans-serif;color:#26265E;font-size:13px;letter-spacing:.8px;margin:18px 0 6px">${line.replace(/[=-]+/g, '')}</h2>`;
    }
    return `<p style="font-family:system-ui,sans-serif;color:#4A4E69;font-size:13px;line-height:1.45;margin:0 0 4px">${line.replace(/</g, '<')}</p>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"/></head>
  <body style="background:#FBFBFD;padding:28px;max-width:720px;margin:0 auto">
    <div style="font-family:system-ui,sans-serif;color:#E85A50;font-size:11px;font-weight:800;letter-spacing:1px">RESCUE ARMY</div>
    ${blocks}
  </body></html>`;
}

export function exportVetSummaryTxt(data: SummaryData) {
  const text = '\uFEFF' + generateVetSummaryText(data);
  if (typeof window !== 'undefined') {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vet-summary-${data.pet.name || 'pet'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export async function exportVetSummaryPdf(data: SummaryData) {
  const html = generateHtml(data);
  try {
    const Print = await import('expo-print');
    await Print.printAsync({ html });
  } catch {
    if (typeof window !== 'undefined') {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        w.print();
      }
    }
  }
}

export function VetSummaryExport({ data }: { data: SummaryData }) {
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <TouchableOpacity style={styles.exportBtn} onPress={() => exportVetSummaryTxt(data)} activeOpacity={0.85}>
          <Download color={Colors.navy} size={16} />
          <Text style={styles.exportText}>Export .txt</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pdfBtn} onPress={async () => { setBusy(true); await exportVetSummaryPdf(data); setBusy(false); }} activeOpacity={0.85} disabled={busy}>
          {busy ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.pdfText}>Export PDF</Text>}
        </TouchableOpacity>
      </View>
      <Text style={styles.disclaimer}>
        UTF-8 summary of vaccinations (by type), last exam, conditions, meds, and abnormal labs. Reminder-only rows are omitted.
      </Text>
    </View>
  );
}

export default VetSummaryExport;

const styles = StyleSheet.create({
  container: { marginBottom: 16, marginTop: 12 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: Colors.surface, alignSelf: 'flex-start' },
  exportText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.navy },
  pdfBtn: { backgroundColor: Colors.navy, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, alignSelf: 'flex-start' },
  pdfText: { fontSize: FontSizes.sm, fontFamily: Fonts.semibold, color: Colors.white },
  disclaimer: { fontSize: FontSizes.xs, fontFamily: Fonts.regular, color: Colors.textTertiary, marginTop: 6, lineHeight: 16 },
});
