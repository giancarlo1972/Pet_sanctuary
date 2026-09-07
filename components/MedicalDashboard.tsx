import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Fonts } from '@/constants/Fonts';
import { AreaChart, HealthRing, RefBand } from '@/components/MedicalCharts';
import { LabSparkline as MiniSpark } from '@/components/PetCharts';
import { SourceBadge } from '@/components/SourceBadge';

export const EXAM_PILLS = [
  'Oral-Nasal-Throat', 'Ears', 'Eyes', 'Cardiovascular', 'Respiratory', 'Abdominal',
  'Genitourinary', 'Musculoskeletal', 'Integument', 'Lymphatics', 'Neurological', 'Rectal',
];

export function classifyLab(name: string): 'Hematology' | 'Chemistry' | 'Endocrinology' | 'Urinalysis' {
  const q = (name || '').toLowerCase();
  if (/hct|pcv|rbc|wbc|hgb|plt|platelet|mcv|mch|neut|lymph|eos|baso|mono|total solids|retic|hemoglobin/.test(q)) return 'Hematology';
  if (/t4|fpl|cortisol|tsh|insulin|thyroxine/.test(q)) return 'Endocrinology';
  if (/usg|urin|ketone|crystal|cast|bacteri|ph\b|protein.*urine|ua |specific gravity/.test(q)) return 'Urinalysis';
  return 'Chemistry';
}

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MedicalDashboard(props: {
  petName: string;
  verdict: string;
  healthScore: number;
  latestLb: number | null;
  targetLb: number | null;
  weightDelta: number | null;
  weightPts: { v: number; at?: string | null; out?: boolean }[];
  bcs: number | null;
  bcsDelta: number | null;
  bcsPts: { v: number; at?: string | null }[];
  risks: string[];
  lastExam: any | null;
  exams: any[];
  vitals: { recorded_at: string; temp_f?: number | null; hr?: number | null; rr?: number | null; weight_lb?: number | null; bcs?: number | null }[];
  labRows: any[];
  labCatalog: { name: string; unit?: string | null; ref_low?: number | null; ref_high?: number | null }[];
  meds: { id: string; name: string; dose?: string | null; route?: string | null; administered_on?: string | null; status?: string | null; source?: string | null }[];
  diagnostics: { id: string; kind: string; name: string; result?: string | null; taken_on?: string | null }[];
  aiFindings: any;
  aiRuns: any[];
  aiBusy: boolean;
  aiShared: boolean;
  onRunAi: () => void;
  onShareAi: () => void;
  onSelectRun: (r: any) => void;
}) {
  const [sys, setSys] = useState<string | null>(null);
  const [labOpen, setLabOpen] = useState<Record<string, boolean>>({ Hematology: true, Chemistry: true, Endocrinology: true, Urinalysis: true });
  const exam = props.lastExam;
  const systems = useMemo(() => {
    const from = exam?.systems || [];
    return EXAM_PILLS.map((name) => {
      const hit = from.find((s: any) => String(s.name || '').toLowerCase().includes(name.split(/[- ]/)[0].toLowerCase()) || String(s.name) === name);
      const status = (hit?.status || 'normal').toLowerCase();
      return { name, status, note: hit?.note || null };
    });
  }, [exam]);
  const sysHistory = (name: string) =>
    props.exams.map((e) => {
      const hit = (e.systems || []).find((s: any) => String(s.name || '').toLowerCase().includes(name.split(/[- ]/)[0].toLowerCase()));
      return hit ? { date: e.visit_date, status: hit.status, note: hit.note } : null;
    }).filter(Boolean) as any[];

  const labItems = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const row of props.labRows) {
      const name = (row.analyte || row.name || '').trim();
      if (!name) continue;
      const arr = groups.get(name.toLowerCase()) || [];
      arr.push(row);
      groups.set(name.toLowerCase(), arr);
    }
    return [...groups.entries()].map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => String(a.collected_on || a.created_at || '').localeCompare(String(b.collected_on || b.created_at || '')));
      const cur = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      const curN = parseFloat(cur.value ?? cur.value_num ?? cur.value_text);
      const prevN = prev ? parseFloat(prev.value ?? prev.value_num ?? prev.value_text) : NaN;
      const cat = props.labCatalog.find((c) => c.name.toLowerCase() === key || (c.name || '').toLowerCase() === String(cur.analyte || '').toLowerCase());
      const flag = String(cur.flag || '').toLowerCase();
      const nums = sorted.map((r) => parseFloat(r.value ?? r.value_num ?? r.value_text)).filter((n) => !Number.isNaN(n));
      return {
        key,
        label: cur.analyte || cur.name,
        group: classifyLab(cur.analyte || cur.name),
        value: cur.value ?? cur.value_text ?? cur.value_num,
        unit: cur.unit || cat?.unit || '',
        flag,
        delta: !Number.isNaN(curN) && !Number.isNaN(prevN) ? curN - prevN : null,
        nums,
        dates: sorted.map((r) => r.collected_on || r.created_at),
        low: cur.ref_low ?? cat?.ref_low ?? null,
        high: cur.ref_high ?? cat?.ref_high ?? null,
        n: sorted.length,
        first: sorted[0]?.collected_on || sorted[0]?.created_at,
        last: cur.collected_on || cur.created_at,
        abnormal: flag === 'high' || flag === 'low' || flag === 'abnormal',
        source: cur.source,
      };
    }).sort((a, b) => Number(b.abnormal) - Number(a.abnormal) || a.label.localeCompare(b.label));
  }, [props.labRows, props.labCatalog]);

  const grouped = {
    Hematology: labItems.filter((i) => i.group === 'Hematology'),
    Chemistry: labItems.filter((i) => i.group === 'Chemistry'),
    Endocrinology: labItems.filter((i) => i.group === 'Endocrinology'),
    Urinalysis: labItems.filter((i) => i.group === 'Urinalysis'),
  };

  const vitalsPts = (key: 'temp_f' | 'hr' | 'rr' | 'weight_lb' | 'bcs') =>
    props.vitals.filter((v) => v[key] != null).map((v) => ({ v: Number(v[key]), at: formatDate(v.recorded_at) }));

  const [expand, setExpand] = useState<Record<string, boolean>>({});

  const wDelta = props.weightDelta;
  const bcsDelta = props.bcsDelta;
  const up = (d: number | null) => d != null && d > 0;
  const down = (d: number | null) => d != null && d < 0;
  const Delta = ({ d }: { d: number | null }) => d == null ? null : (
    <View style={[styles.delta, { backgroundColor: down(d) ? Colors.tealBg : up(d) ? Colors.coralBg : Colors.surface }]}>
      <Text style={{ fontFamily: Fonts.bold, fontSize: 11, color: down(d) ? Colors.tealDark : up(d) ? Colors.coral : Colors.textTertiary }}>
        {up(d) ? '↑' : down(d) ? '↓' : '•'} {Math.abs(Math.round(d * 10) / 10)}
      </Text>
    </View>
  );
  const Foot = ({ n, id }: { n: number; id: string }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={styles.foot}>First to last · {n} measurements</Text>
      {n > 6 ? (
        <TouchableOpacity onPress={() => setExpand((s) => ({ ...s, [id]: !s[id] }))}>
          <Text style={styles.link}>{expand[id] ? 'Show less' : 'View all →'}</Text>
        </TouchableOpacity>
      ) : <Text style={styles.link}>View all →</Text>}
    </View>
  );

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.kpiRow}>
        <View style={styles.kpiTile}>
          <Text style={styles.kpiK}>Health score</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <HealthRing score={props.healthScore} light size={64} />
            <Text style={styles.kpiHintDark}>{props.verdict}</Text>
          </View>
        </View>
        <View style={styles.kpiTile}>
          <Text style={styles.kpiK}>Weight</Text>
          <Text style={styles.kpiVDark}>{props.latestLb != null ? props.latestLb : '—'}<Text style={styles.kpiUDark}> lb</Text></Text>
          <Delta d={wDelta} />
          {props.targetLb != null ? <Text style={styles.kpiHintDark}>target {props.targetLb} lb</Text> : null}
          {props.weightPts.length > 1 ? <View style={{ position: 'absolute', right: 8, bottom: 8, opacity: 0.35, width: 90 }}><MiniSpark values={props.weightPts.map((p) => p.v)} color={Colors.teal} height={28} /></View> : null}
        </View>
        <View style={styles.kpiTile}>
          <Text style={styles.kpiK}>BCS</Text>
          <Text style={styles.kpiVDark}>{props.bcs != null ? props.bcs : '—'}<Text style={styles.kpiUDark}> /9</Text></Text>
          <Delta d={bcsDelta} />
          {props.bcsPts.length > 1 ? <View style={{ position: 'absolute', right: 8, bottom: 8, opacity: 0.35, width: 90 }}><MiniSpark values={props.bcsPts.map((p) => p.v)} color={Colors.accent} height={28} /></View> : null}
        </View>
        <View style={styles.kpiTile}>
          <Text style={styles.kpiK}>Main risk</Text>
          <Text style={[styles.kpiVDark, { fontSize: 16 }]} numberOfLines={2}>{props.risks[0] || 'None flagged'}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {props.risks.slice(1, 3).map((r) => (
              <View key={r} style={styles.riskChipLight}><Text style={styles.riskTxtDark} numberOfLines={1}>{r}</Text></View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>VET EXAM{exam ? ` · ${formatDate(exam.visit_date)}` : ''}</Text>
        <View style={styles.pillGrid}>
          {systems.map((s) => {
            const bg = s.status === 'abnormal' ? Colors.coralBg : s.status === 'watch' || s.status === 'monitoring' ? Colors.standardBg : Colors.tealBg;
            const fg = s.status === 'abnormal' ? Colors.coral : s.status === 'watch' || s.status === 'monitoring' ? Colors.accentDark : Colors.tealDark;
            return (
              <TouchableOpacity key={s.name} onPress={() => setSys(sys === s.name ? null : s.name)} style={[styles.sysPill, { backgroundColor: bg }]}>
                <Text style={[styles.sysTxt, { color: fg }]}>{s.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {sys ? (
          <View style={{ marginTop: 8, gap: 4 }}>
            <Text style={styles.body}>{systems.find((s) => s.name === sys)?.note || 'Normal — no extra note.'}</Text>
            {sysHistory(sys).map((h, i) => (
              <Text key={i} style={styles.foot}>{formatDate(h.date)} · {h.status}{h.note ? ` — ${h.note}` : ''}</Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>WEIGHT + BCS</Text>
        <AreaChart
          points={props.weightPts.map((p) => ({ ...p, out: props.targetLb != null && p.v > props.targetLb * 1.08 }))}
          secondary={props.bcsPts}
          height={160}
          target={props.targetLb}
          unit="lb"
        />
        <Foot n={props.weightPts.length} id="weight" />
      </View>

      {([
        ['Temperature', 'temp_f', '°F'] as const,
        ['Heart rate', 'hr', 'bpm'] as const,
        ['Resp rate', 'rr', '/min'] as const,
      ]).map(([label, key, unit]) => {
        const pts = vitalsPts(key);
        return (
          <View key={label} style={styles.card}>
            <Text style={styles.kicker}>{label.toUpperCase()}</Text>
            <AreaChart points={pts} height={120} unit={unit} />
            <Foot n={pts.length} id={key} />
          </View>
        );
      })}

      {(['Hematology', 'Chemistry', 'Endocrinology', 'Urinalysis'] as const).map((g) => (
        <View key={g} style={styles.card}>
          <TouchableOpacity onPress={() => setLabOpen((s) => ({ ...s, [g]: !s[g] }))} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.kicker}>{g.toUpperCase()}</Text>
            <Text style={styles.link}>{labOpen[g] === false ? 'Show' : 'Hide'} · {grouped[g].length}</Text>
          </TouchableOpacity>
          {labOpen[g] !== false ? grouped[g].map((it) => (
            <View key={it.key} style={styles.labRow}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <Text style={styles.labName}>{it.label}</Text>
                <SourceBadge source={it.source} />
                <Text style={[styles.labVal, { color: it.abnormal ? Colors.coral : Colors.navy }]}>
                  {it.value ?? '—'}{it.unit ? ` ${it.unit}` : ''}
                  {it.delta != null ? `  ${it.delta > 0 ? '▲' : it.delta < 0 ? '▼' : '•'}${Math.abs(Math.round(it.delta * 100) / 100)}` : ''}
                </Text>
              </View>
              <RefBand value={typeof it.value === 'number' ? it.value : parseFloat(it.value)} low={it.low} high={it.high} flag={it.flag} />
              {it.nums.length > 0 ? <MiniSpark values={it.nums} color={it.abnormal ? Colors.coral : '#2E9E96'} height={40} /> : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.foot}>First to last · {it.n} measurements</Text>
                <Text style={styles.link}>View all →</Text>
              </View>
            </View>
          )) : null}
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.kicker}>MEDICATIONS</Text>
        {props.meds.length === 0 ? <Text style={styles.foot}>No medications recorded.</Text> : props.meds.map((m) => (
          <View key={m.id} style={styles.medRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.labName}>{m.name}</Text>
                <SourceBadge source={m.source} />
              </View>
              <Text style={styles.foot}>{[m.dose, m.route].filter(Boolean).join(' · ') || '—'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.foot}>{m.administered_on ? formatDate(m.administered_on) : '—'}</Text>
              <Text style={{ fontFamily: Fonts.bold, fontSize: 11, color: m.status === 'completed' ? Colors.textTertiary : Colors.tealDark }}>{m.status || 'active'}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>DIAGNOSTICS</Text>
        {props.diagnostics.length === 0 ? <Text style={styles.foot}>No imaging or PCR on file.</Text> : props.diagnostics.map((d) => (
          <View key={d.id} style={{ gap: 2, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
            <Text style={styles.labName}>{d.name} · {d.kind}</Text>
            <Text style={styles.body}>{d.result || '—'}</Text>
            <Text style={styles.foot}>{formatDate(d.taken_on)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>AI NOTES</Text>
        <Text style={styles.warn}>AI is not a veterinarian. Findings are for your vet — no diagnosis from Rescue Army.</Text>
        {props.aiFindings ? (
          <>
            <Text style={styles.labName}>Run {props.aiFindings.run_number || 1} · {formatDate(props.aiFindings.ran_at)}</Text>
            {props.aiFindings.diff_vs_previous ? <Text style={styles.foot}>{props.aiFindings.diff_vs_previous}</Text> : null}
            {(props.aiFindings.findings || []).slice(0, 5).map((f: any, i: number) => (
              <Text key={i} style={styles.body}>{f.title} — {f.body || f.detail}</Text>
            ))}
            {props.aiFindings.conclusion ? <Text style={styles.labName}>{props.aiFindings.conclusion}</Text> : null}
          </>
        ) : <Text style={styles.foot}>No AI note yet.</Text>}
        {props.aiRuns.slice(1).map((r) => (
          <TouchableOpacity key={r.id} onPress={() => props.onSelectRun(r)}>
            <Text style={styles.link}>Run {r.run_number || r.run_no} · {formatDate(r.created_at)} ▾</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.primary} onPress={props.onRunAi} disabled={props.aiBusy}>
          {props.aiBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryTxt}>Run AI Health</Text>}
        </TouchableOpacity>
        {props.aiFindings ? (
          <TouchableOpacity style={styles.navyBtn} onPress={props.onShareAi}>
            <Text style={styles.primaryTxt}>{props.aiShared ? 'Shared with vet ✓' : 'Share with vet'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navy: { backgroundColor: Colors.navy, borderRadius: 16, padding: 16, gap: 4 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiTile: { width: '48%', backgroundColor: Colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, minHeight: 118, overflow: 'hidden', gap: 4 },
  kpiVDark: { fontFamily: Fonts.extrabold, fontSize: 26, color: Colors.navy },
  kpiUDark: { fontFamily: Fonts.medium, fontSize: 13, color: Colors.textTertiary },
  kpiHintDark: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textTertiary },
  riskChipLight: { backgroundColor: Colors.standardBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  riskTxtDark: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.accentDark },
  navyKicker: { fontFamily: Fonts.extrabold, fontSize: 11, letterSpacing: 0.8, color: '#B9BCE0' },
  navySub: { fontFamily: Fonts.bold, fontSize: 16, color: Colors.white },
  riskChip: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, maxWidth: 160 },
  riskTxt: { fontFamily: Fonts.bold, fontSize: 11, color: '#FCE9C8' },
  kpi: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 12, gap: 4 },
  kpiK: { fontFamily: Fonts.bold, fontSize: 11, color: '#B9BCE0' },
  kpiV: { fontFamily: Fonts.extrabold, fontSize: 26, color: Colors.white },
  kpiU: { fontFamily: Fonts.medium, fontSize: 13, color: '#B9BCE0' },
  kpiHint: { fontFamily: Fonts.regular, fontSize: 11, color: '#B9BCE0' },
  delta: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  card: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  kicker: { fontFamily: Fonts.extrabold, fontSize: 11, letterSpacing: 0.8, color: Colors.textTertiary },
  pillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sysPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  sysTxt: { fontFamily: Fonts.bold, fontSize: 11 },
  body: { fontFamily: Fonts.regular, fontSize: 13, color: Colors.textBody, lineHeight: 18 },
  foot: { fontFamily: Fonts.regular, fontSize: 11, color: Colors.textTertiary },
  link: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.tealDark },
  labRow: { gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  labName: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.navy, flex: 1 },
  labVal: { fontFamily: Fonts.bold, fontSize: 13 },
  medRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  warn: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.critical, backgroundColor: Colors.criticalBg, borderRadius: 10, padding: 10, overflow: 'hidden' },
  primary: { backgroundColor: Colors.coral, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  navyBtn: { backgroundColor: Colors.navy, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryTxt: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.white },
});
