import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { Card } from '@/components/Card';

export const EXAM_PILLS = [
  'Oral-Nasal-Throat', 'Ears', 'Eyes', 'Cardiovascular', 'Respiratory', 'Abdominal',
  'Genitourinary', 'Musculoskeletal', 'Integument', 'Lymphatics', 'Neurological', 'Rectal',
  'Mucous membranes',
];

function fmt(iso?: string | null) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso ? String(iso).slice(0, 10) : '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
}

function matchSystem(from: any[], name: string) {
  const n = name.toLowerCase();
  const first = n.split(/[- ]/)[0];
  return (from || []).find((s) => {
    const sn = String(s.name || '').toLowerCase();
    if (!sn) return false;
    if (sn === n || sn.includes(n) || n.includes(sn)) return true;
    if (first.length > 3 && sn.includes(first)) return true;
    if (/mucous|mm\b/.test(n) && /mucous|mm\b|membrane/.test(sn)) return true;
    return false;
  }) || null;
}

function classify(hit: any | null, name: string, blob: string): 'normal' | 'abnormal' | 'not_examined' {
  const status = String(hit?.status || '').toLowerCase();
  const note = String(hit?.note || '');
  const combined = `${status} ${note} ${blob}`;
  if (/musculo/.test(name.toLowerCase()) && /not jumping|lameness|ortho|musculoskel\w*.{0,40}abnormal/i.test(combined)) {
    return 'abnormal';
  }
  if (/abnormal|enlarged|inflamed|pale|white|icteric|cyanotic/.test(status + ' ' + note)) return 'abnormal';
  if (status === 'watch' || status === 'monitoring') return 'abnormal';
  if (hit && (status === 'normal' || status === 'wnl' || status === 'nsf' || /pink|wnl|nsf|unremarkable|normal/.test(note))) return 'normal';
  if (hit) return 'normal';
  return 'not_examined';
}

function mmLabel(exam: any | null) {
  const v = exam?.vitals || {};
  const raw = v.mm || v.mucous_membranes || v.mucousMembranes || null;
  const hit = matchSystem(exam?.systems || [], 'Mucous membranes');
  const fromNote = String(hit?.note || '').match(/pink|pale|white|icteric|cyanotic|injected/i)?.[0];
  const color = raw || fromNote;
  if (color) return `Mucous membranes · ${String(color).toLowerCase()}`;
  return 'Mucous membranes';
}

function vitalsLine(v: any | null) {
  if (!v) return '';
  const parts: string[] = [];
  if (v.temp_f != null) parts.push(`T ${v.temp_f}°F`);
  if (v.hr != null) parts.push(`HR ${v.hr}`);
  if (v.rr != null) parts.push(`RR ${v.rr}`);
  if (v.bcs != null) parts.push(`BCS ${v.bcs}`);
  if (v.pain != null) parts.push(`Pain ${v.pain}`);
  return parts.join(' · ');
}

export default function VetExamCard({
  exam,
  exams,
  hints,
  onUpload,
}: {
  exam: any | null;
  exams: any[];
  hints?: string;
  onUpload?: () => void;
}) {
  const [sys, setSys] = useState<string | null>(null);
  const blob = useMemo(() => `${JSON.stringify(exams || [])} ${hints || ''}`, [exams, hints]);
  const systems = useMemo(() => {
    const from = exam?.systems || [];
    return EXAM_PILLS.map((name) => {
      const hit = matchSystem(from, name);
      return {
        name,
        label: name === 'Mucous membranes' ? mmLabel(exam) : name,
        status: classify(hit, name, blob),
        note: hit?.note || null,
      };
    });
  }, [exam, blob]);

  const sysHistory = (name: string) =>
    (exams || []).map((e) => {
      const hit = matchSystem(e.systems || [], name);
      if (!hit) return null;
      return { date: e.visit_date, status: hit.status, note: hit.note, clinic: e.clinic };
    }).filter(Boolean) as any[];

  const title = exam
    ? `Latest vet visit — ${[exam.clinic, exam.visit_date ? fmt(exam.visit_date) : null].filter(Boolean).join(', ') || 'no date'}`
    : 'Latest vet visit';
  const vitals = vitalsLine(exam?.vitals);

  return (
    <Card identity>
      <Text style={styles.kicker}>{title}</Text>
      {!exam ? (
        <TouchableOpacity onPress={onUpload} activeOpacity={0.85}>
          <Text style={styles.empty}>No exam yet — upload a visit record</Text>
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.pillGrid}>
            {systems.map((s) => {
              const bg = s.status === 'abnormal' ? Colors.coralBg : s.status === 'normal' ? Colors.tealBg : Colors.surface;
              const fg = s.status === 'abnormal' ? Colors.coral : s.status === 'normal' ? Colors.tealDark : Colors.textTertiary;
              return (
                <TouchableOpacity
                  key={s.name}
                  onPress={() => setSys(sys === s.name ? null : s.name)}
                  style={[styles.sysPill, { backgroundColor: bg }]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.sysTxt, { color: fg }]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {vitals ? <Text style={styles.vitals}>{vitals}</Text> : null}
          {sys ? (
            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>{systems.find((s) => s.name === sys)?.label}</Text>
              <Text style={styles.body}>
                {systems.find((s) => s.name === sys)?.note
                  || (systems.find((s) => s.name === sys)?.status === 'not_examined' ? 'Not examined on this visit.' : 'Normal — no extra note.')}
              </Text>
              {sysHistory(sys).map((h, i) => (
                <Text key={i} style={styles.foot}>
                  {fmt(h.date)}{h.clinic ? ` · ${h.clinic}` : ''} · {h.status}{h.note ? ` — ${h.note}` : ''}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  kicker: { fontFamily: Fonts.extrabold, fontSize: 13, letterSpacing: 0.2, color: Colors.navy, textTransform: 'none' },
  empty: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.navy, lineHeight: 18 },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sysPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  sysTxt: { fontFamily: Fonts.bold, fontSize: 11 },
  vitals: { fontFamily: Fonts.semibold, fontSize: 12, color: Colors.navy, marginTop: 4 },
  noteBox: { marginTop: 4, gap: 4, backgroundColor: Colors.surface, borderRadius: 12, padding: 10 },
  noteTitle: { fontFamily: Fonts.bold, fontSize: 13, color: Colors.navy },
  body: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textBody, lineHeight: 18 },
  foot: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textTertiary },
});
